import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from dotenv import load_dotenv

from database import db_cursor
from routers import auth_router, drill_router, tracker_router, checklist_router, approval_router
from routers import column_router, documents_router

load_dotenv()


@asynccontextmanager
async def lifespan(app: FastAPI):
    with db_cursor() as (cursor, conn):
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS tracker_columns (
                id INT AUTO_INCREMENT PRIMARY KEY,
                tracker_group VARCHAR(300) NOT NULL,
                col_name VARCHAR(100) NOT NULL,
                col_order INT DEFAULT 0,
                UNIQUE KEY uq_tc (tracker_group(250), col_name)
            )
        """)
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS checklist_columns (
                id INT AUTO_INCREMENT PRIMARY KEY,
                checklist_group VARCHAR(300) NOT NULL,
                col_name VARCHAR(100) NOT NULL,
                col_order INT DEFAULT 0,
                UNIQUE KEY uq_cc (checklist_group(250), col_name)
            )
        """)
        conn.commit()
        for table in ("drill_tracker", "checklist"):
            try:
                cursor.execute(f"ALTER TABLE `{table}` ADD COLUMN `row_data` JSON")
                conn.commit()
            except Exception:
                conn.rollback()
    yield


app = FastAPI(
    title="Drill Management & Compliance Tracking System",
    description="API for Drill Management, Tracker, Checklist, and Approval workflows",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

UPLOAD_DIR = os.getenv("UPLOAD_DIR", "uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=UPLOAD_DIR), name="uploads")
app.mount("/doc-files", StaticFiles(directory="/data/files/documents"), name="doc_files")

app.include_router(auth_router.router)
app.include_router(drill_router.router)
app.include_router(tracker_router.router)
app.include_router(checklist_router.router)
app.include_router(approval_router.router)
app.include_router(column_router.router)
app.include_router(documents_router.router)


@app.get("/")
def root():
    return {"message": "Drill Management System API", "version": "1.0.0", "status": "running"}


@app.get("/health")
def health():
    return {"status": "healthy"}
