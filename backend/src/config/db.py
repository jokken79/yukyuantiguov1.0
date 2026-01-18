"""
Database configuration and connection management for Yukyu Pro
"""
import sqlite3
import os

# Database path - relative to project root
DB_PATH = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "yukyu.db")


def get_db_connection():
    """Get a database connection with row_factory set"""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    """Initialize database tables if they don't exist"""
    conn = get_db_connection()
    c = conn.cursor()
    
    c.execute('''
        CREATE TABLE IF NOT EXISTS employees (
            id TEXT PRIMARY KEY,
            employee_num TEXT,
            name TEXT,
            haken TEXT,
            granted REAL,
            used REAL,
            balance REAL,
            usage_rate REAL,
            year INTEGER,
            period_history TEXT,
            yukyu_dates TEXT,
            last_updated TEXT
        )
    ''')
    
    c.execute('''
        CREATE TABLE IF NOT EXISTS leave_records (
            id TEXT PRIMARY KEY,
            employee_id TEXT,
            date TEXT,
            type TEXT,
            duration TEXT,
            note TEXT,
            status TEXT,
            created_at TEXT
        )
    ''')
    
    conn.commit()
    conn.close()
