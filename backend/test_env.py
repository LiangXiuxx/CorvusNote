print("Testing Python environment...")
try:
    import sys
    print(f"Python version: {sys.version}")
    
    # 检查基本导入
    import pydantic
    import pymongo
    import fastapi
    import uvicorn
    
    print("All required packages are installed successfully!")
    
    # 检查环境变量
    import os
    print(f"Current directory: {os.getcwd()}")
    print(f"Backend directory exists: {os.path.exists('.')}")
    print(f"main.py exists: {os.path.exists('main.py')}")
    
    # 尝试导入我们的模块
    try:
        from app.core.config import settings
        print(f"Config imported successfully: {settings.MONGODB_URL}")
    except Exception as e:
        print(f"Error importing config: {e}")
        
    print("Environment test completed successfully!")
except Exception as e:
    print(f"Error: {e}")
    import traceback
    traceback.print_exc()
