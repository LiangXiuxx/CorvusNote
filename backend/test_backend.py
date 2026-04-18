#!/usr/bin/env python3
"""
简化的后端测试脚本，用于验证基本功能
"""

print("=== CorvusNote 后端测试 ===")

# 测试 1: 基本导入
try:
    print("1. 测试基本导入...")
    import os
    import sys
    print(f"   Python 版本: {sys.version}")
    print(f"   当前目录: {os.getcwd()}")
    print("   ✓ 基本导入成功")
except Exception as e:
    print(f"   ✗ 基本导入失败: {e}")
    sys.exit(1)

# 测试 2: 检查依赖包
try:
    print("2. 测试依赖包...")
    import fastapi
    import uvicorn
    import pymongo
    import pydantic
    import jose
    import passlib
    print(f"   ✓ FastAPI: {fastapi.__version__}")
    print(f"   ✓ Uvicorn: {uvicorn.__version__}")
    print(f"   ✓ PyMongo: {pymongo.__version__}")
    print(f"   ✓ Pydantic: {pydantic.__version__}")
    print("   ✓ 所有依赖包导入成功")
except Exception as e:
    print(f"   ✗ 依赖包导入失败: {e}")
    print("   请运行: python -m pip install -r requirements.txt")
    sys.exit(1)

# 测试 3: 检查配置文件
try:
    print("3. 测试配置文件...")
    if os.path.exists(".env"):
        print("   ✓ .env 文件存在")
    else:
        print("   ⚠ .env 文件不存在，将使用默认配置")
    
    if os.path.exists("main.py"):
        print("   ✓ main.py 文件存在")
    else:
        print("   ✗ main.py 文件不存在")
        sys.exit(1)
        
except Exception as e:
    print(f"   ✗ 配置检查失败: {e}")
    sys.exit(1)

# 测试 4: 检查目录结构
try:
    print("4. 测试目录结构...")
    required_dirs = ["app", "uploads"]
    for dir_name in required_dirs:
        if os.path.exists(dir_name):
            print(f"   ✓ {dir_name} 目录存在")
        else:
            print(f"   ⚠ {dir_name} 目录不存在，将自动创建")
            os.makedirs(dir_name, exist_ok=True)
    print("   ✓ 目录结构检查完成")
except Exception as e:
    print(f"   ✗ 目录结构检查失败: {e}")
    sys.exit(1)

print("\n=== 测试完成 ===")
print("后端服务基本配置正常，可以在实际环境中部署运行。")
print("\n部署步骤:")
print("1. 确保 MongoDB 服务已启动")
print("2. 在 backend 目录下运行:")
print("   python main.py")
print("3. 访问 API 文档:")
print("   http://localhost:8000/docs")
