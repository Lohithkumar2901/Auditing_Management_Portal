from datetime import datetime, timedelta
from typing import Optional

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
import bcrypt
import os
from dotenv import load_dotenv

load_dotenv()

SECRET_KEY = os.getenv("SECRET_KEY", "fallback-secret-key")
ALGORITHM = os.getenv("ALGORITHM", "HS256")
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", 480))

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")

# Pre-hashed passwords (bcrypt).  To add users, run:
#   python3 -c "import bcrypt; print(bcrypt.hashpw(b'yourpass', bcrypt.gensalt()).decode())"
USERS_DB = {
    "admin": {
        "username": "admin",
        "hashed_password": "$2b$12$hZb0aiqLXn7NT5fqgRRedOU6gHA4KU185c8dtvLMJtgVSj0EbudiG",  # admin123
        "role": "admin",
        "full_name": "System Administrator",
    },
    "technician": {
        "username": "technician",
        "hashed_password": "$2b$12$examplehash.fortech123.placeholder.technician.user.xx",
        "role": "technician",
        "full_name": "Field Technician",
    },
    "tech2": {
        "username": "tech2",
        "hashed_password": "$2b$12$examplehash.fortech123.placeholder.tech2.user.xxxxxx",
        "role": "technician",
        "full_name": "NOC Technician",
    },
    "reviewer": {
        "username": "reviewer",
        "hashed_password": "$2b$12$placeholder.reviewer.hash.xxxxxxxxxxxxxxxxxxxxxxxx",
        "role": "reviewer",
        "full_name": "Document Reviewer",
    },
    "auditor": {
        "username": "auditor",
        "hashed_password": "$2b$12$placeholder.auditor.hash.xxxxxxxxxxxxxxxxxxxxxxxx",
        "role": "auditor",
        "full_name": " Auditor",
    },
}


def _hash_and_store():
    """Called once at startup to set correct hashes."""
    passwords = {"admin": "Wheels@123", "technician": "Wheels@1234", "tech2": "Wheels@1234", "reviewer": "Wheels@135", "auditor": "Wheels@321"}
    for uname, pwd in passwords.items():
        USERS_DB[uname]["hashed_password"] = bcrypt.hashpw(
            pwd.encode(), bcrypt.gensalt()
        ).decode()


_hash_and_store()


def authenticate_user(username: str, password: str):
    user = USERS_DB.get(username.lower())  # case-insensitive username
    if not user:
        return None
    if not bcrypt.checkpw(password.encode(), user["hashed_password"].encode()):
        return None
    return user


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    expire = datetime.utcnow() + (expires_delta or timedelta(minutes=15))
    to_encode["exp"] = expire
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


def get_current_user(token: str = Depends(oauth2_scheme)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception
    user = USERS_DB.get(username)
    if user is None:
        raise credentials_exception
    return user


def require_admin(current_user: dict = Depends(get_current_user)):
    if current_user["role"] != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin privileges required",
        )
    return current_user


def require_reviewer_or_admin(current_user: dict = Depends(get_current_user)):
    if current_user["role"] not in ("reviewer", "admin"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Reviewer or Admin privileges required",
        )
    return current_user
