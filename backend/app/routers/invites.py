import secrets
from datetime import datetime, timedelta, UTC

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, EmailStr

from app.auth import get_current_user_id
from app.config import settings
from app.supabase_client import get_supabase

router = APIRouter(prefix="/invites", tags=["invites"])


class CreateInviteRequest(BaseModel):
    group_id: str
    email: EmailStr | None = None


class AcceptInviteRequest(BaseModel):
    token: str


@router.get("/{token}/preview")
async def preview_invite(token: str):
    """Return minimal invite info without exposing token table contents to the client."""
    if len(token) < 16:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid invite token")

    sb = get_supabase()
    invite_result = (
        sb.table("invites")
        .select("id, expires_at, used_at, friend_groups(name), profiles!referrer_id(display_name, username)")
        .eq("invite_token", token)
        .single()
        .execute()
    )

    if not invite_result.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Invite not found")

    invite = invite_result.data
    if invite["used_at"] is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Invite already used")
    if datetime.fromisoformat(invite["expires_at"]) < datetime.now(UTC):
        raise HTTPException(status_code=status.HTTP_410_GONE, detail="Invite expired")

    inviter = (invite.get("profiles") or {}).get("display_name") or (invite.get("profiles") or {}).get("username")
    group_name = (invite.get("friend_groups") or {}).get("name")

    return {
        "status": "ok",
        "inviter": inviter,
        "group": group_name,
        "expires_at": invite["expires_at"],
    }


@router.post("/", status_code=status.HTTP_201_CREATED)
async def create_invite(
    body: CreateInviteRequest,
    user_id: str = Depends(get_current_user_id),
):
    """Generate a one-time invite token for a group. Only group owner can invite."""
    sb = get_supabase()

    # Verify requester is the group owner
    group = sb.table("friend_groups").select("owner_id").eq("id", body.group_id).single().execute()
    if not group.data or group.data["owner_id"] != user_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only the group owner can invite members")

    token = secrets.token_urlsafe(32)
    expires_at = (datetime.now(UTC) + timedelta(days=7)).isoformat()

    sb.table("invites").insert({
        "referrer_id": user_id,
        "invite_token": token,
        "group_id": body.group_id,
        "email": body.email,
        "expires_at": expires_at,
    }).execute()

    frontend_base = settings.frontend_origin.rstrip("/")
    invite_url = f"{frontend_base}/#/invite?token={token}"
    return {"invite_url": invite_url, "token": token, "expires_at": expires_at}


@router.post("/accept")
async def accept_invite(
    body: AcceptInviteRequest,
    user_id: str = Depends(get_current_user_id),
):
    """Accept an invite: validate token, add user to group, mark token used."""
    if len(body.token) < 16:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid invite token")

    sb = get_supabase()

    invite_result = sb.table("invites").select("*").eq("invite_token", body.token).single().execute()
    if not invite_result.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Invite not found")

    invite = invite_result.data
    if invite["used_at"] is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Invite already used")
    if datetime.fromisoformat(invite["expires_at"]) < datetime.now(UTC):
        raise HTTPException(status_code=status.HTTP_410_GONE, detail="Invite expired")

    # Add to group (ignore if already member)
    if invite["group_id"]:
        existing = (
            sb.table("group_members")
            .select("id")
            .eq("group_id", invite["group_id"])
            .eq("user_id", user_id)
            .execute()
        )
        if not existing.data:
            sb.table("group_members").insert({
                "group_id": invite["group_id"],
                "user_id": user_id,
                "role": "member",
            }).execute()

    # Mark invite used
    sb.table("invites").update({
        "used_by": user_id,
        "used_at": datetime.now(UTC).isoformat(),
    }).eq("id", invite["id"]).execute()

    return {"status": "ok", "group_id": invite["group_id"]}
