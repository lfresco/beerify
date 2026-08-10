from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import jwt, JWTError
from app.config import settings
from app.supabase_client import get_supabase

bearer = HTTPBearer()


def _verify_with_supabase(token: str) -> str | None:
    """Validate bearer token through Supabase Auth and return user id when valid."""
    try:
        response = get_supabase().auth.get_user(token)
        user = getattr(response, "user", None)
        user_id = getattr(user, "id", None)
        return str(user_id) if user_id else None
    except Exception:
        return None


def _verify_hs256_legacy(token: str) -> str | None:
    """Fallback for legacy HS256 projects that still use JWT secret verification."""
    payload = jwt.decode(
        token,
        settings.supabase_jwt_secret,
        algorithms=["HS256"],
        issuer=settings.jwt_issuer(),
        options={"verify_aud": False, "require_sub": True, "require_exp": True, "verify_iss": True},
    )
    user_id: str | None = payload.get("sub")
    return user_id


def get_current_user_id(
    creds: HTTPAuthorizationCredentials = Depends(bearer),
) -> str:
    """Verify Supabase JWT and return the user's UUID."""
    token = creds.credentials
    try:
        # Supabase can issue ES256/RS256 access tokens; validate against Supabase first.
        user_id = _verify_with_supabase(token)
        if user_id:
            return user_id

        # Compatibility path for older HS256 projects.
        user_id = _verify_hs256_legacy(token)
        if not user_id:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
        return user_id
    except JWTError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired token") from exc
