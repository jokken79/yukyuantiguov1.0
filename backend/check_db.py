import sqlite3
try:
    conn = sqlite3.connect('yukyu.db')
    c = conn.cursor()
    print("--- Tables ---")
    for row in c.execute("SELECT name FROM sqlite_master WHERE type='table'"):
        print(row[0])
    
    print("\n--- Employees Columns ---")
    try:
        for row in c.execute("PRAGMA table_info(employees)"):
            print(row[1])
    except:
        print("Table employees not found")

    print("\n--- Leave Records Columns ---")
    try:
        for row in c.execute("PRAGMA table_info(leave_records)"):
            print(row[1])
    except:
        print("Table leave_records not found")
        
    conn.close()
except Exception as e:
    print(f"Error: {e}")

