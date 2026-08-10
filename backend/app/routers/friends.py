from datetime import UTC, datetime

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel

from app.auth import get_current_user_id
from app.supabase_client import get_supabase

router = APIRouter(prefix="/friends", tags=["friends"])


class CreateFriendRequestBody(BaseModel):
    recipient_id: str


@router.get("/requests")
async def list_requests(user_id: str = Depends(get_current_user_id)):
    sb = get_supabase()

    incoming = (
        sb.table("friend_requests")
        .select("id, requester_id, recipient_id, status, created_at, responded_at, profiles!requester_id(id, username, display_name, avatar_url)")
        .eq("recipient_id", user_id)
        .order("created_at", desc=True)
        .execute()
    )

    outgoing = (
        sb.table("friend_requests")
        .select("id, requester_id, recipient_id, status, created_at, responded_at, profiles!recipient_id(id, username, display_name, avatar_url)")
        .eq("requester_id", user_id)
        .order("created_at", desc=True)
        .execute()
    )

    return {
        "incoming": incoming.data or [],
        "outgoing": outgoing.data or [],
    }


@router.post("/requests", status_code=status.HTTP_201_CREATED)
async def create_request(body: CreateFriendRequestBody, user_id: str = Depends(get_current_user_id)):
    if body.recipient_id == user_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="You cannot send a friend request to yourself")

    sb = get_supabase()

    recipient = sb.table("profiles").select("id").eq("id", body.recipient_id).limit(1).execute()
    if not recipient.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Recipient not found")

    existing_a = (
        sb.table("friend_requests")
        .select("id, status")
        .eq("requester_id", user_id)
        .eq("recipient_id", body.recipient_id)
        .limit(1)
        .execute()
    )
    existing_b = (
        sb.table("friend_requests")
        .select("id, status")
        .eq("requester_id", body.recipient_id)
        .eq("recipient_id", user_id)
        .limit(1)
        .execute()
    )

    if existing_a.data:
        status_text = existing_a.data[0]["status"]
        if status_text == "pending":
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Friend request already sent")
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="A friend request already exists")

    if existing_b.data:
        status_text = existing_b.data[0]["status"]
        if status_text == "pending":
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="This user already sent you a friend request",
            )
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="A friend request already exists")

    inserted = (
        sb.table("friend_requests")
        .insert(
            {
                "requester_id": user_id,
                "recipient_id": body.recipient_id,
                "status": "pending",
            }
        )
        .execute()
    )

    return {"status": "ok", "request": (inserted.data or [None])[0]}


@router.post("/requests/{request_id}/accept")
async def accept_request(request_id: str, user_id: str = Depends(get_current_user_id)):
    sb = get_supabase()

    req = sb.table("friend_requests").select("*").eq("id", request_id).single().execute()
    data = req.data
    if not data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Friend request not found")

    if data["recipient_id"] != user_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only the recipient can accept this request")

    if data["status"] != "pending":
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Friend request is no longer pending")

    sb.table("friend_requests").update(
        {
            "status": "accepted",
            "responded_at": datetime.now(UTC).isoformat(),
        }
    ).eq("id", request_id).execute()

    return {"status": "ok"}


@router.post("/requests/{request_id}/decline")
async def decline_request(request_id: str, user_id: str = Depends(get_current_user_id)):
    sb = get_supabase()

    req = sb.table("friend_requests").select("*").eq("id", request_id).single().execute()
    data = req.data
    if not data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Friend request not found")

    if data["recipient_id"] != user_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only the recipient can decline this request")

    if data["status"] != "pending":
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Friend request is no longer pending")

    sb.table("friend_requests").update(
        {
            "status": "rejected",
            "responded_at": datetime.now(UTC).isoformat(),
        }
    ).eq("id", request_id).execute()

    return {"status": "ok"}


@router.delete("/requests/{request_id}")
async def cancel_request(request_id: str, user_id: str = Depends(get_current_user_id)):
    sb = get_supabase()

    req = sb.table("friend_requests").select("*").eq("id", request_id).single().execute()
    data = req.data
    if not data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Friend request not found")

    if data["requester_id"] != user_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only the requester can cancel this request")

    if data["status"] != "pending":
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Only pending requests can be cancelled")

    sb.table("friend_requests").delete().eq("id", request_id).execute()
    return {"status": "ok"}
