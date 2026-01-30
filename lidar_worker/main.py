from fastapi import FastAPI, UploadFile, File, HTTPException
import shutil
import os
import uuid
from processor import process_scan

app = FastAPI(title="Microcatchment LiDAR Worker")

UPLOAD_DIR = "/tmp/lidar_uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)

@app.get("/")
def health_check():
    return {"status": "ok", "service": "lidar-worker"}

@app.post("/process-scan")
async def upload_scan(file: UploadFile = File(...)):
    """
    Uploads a .las/.laz file and triggers PDAL processing.
    """
    if not file.filename.endswith(('.las', '.laz')):
        raise HTTPException(status_code=400, detail="Invalid file type. Only .las or .laz allowed.")

    file_id = str(uuid.uuid4())
    file_path = os.path.join(UPLOAD_DIR, f"{file_id}_{file.filename}")

    try:
        # Save uploaded file
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
            
        # Process with PDAL
        result = process_scan(file_path, UPLOAD_DIR)
        
        if result.get("status") == "error":
             raise HTTPException(status_code=500, detail=result.get("message"))
             
        # Cleanup input file
        os.remove(file_path)
             
        return {
            "file_id": file_id,
            "filename": file.filename,
            "result": result
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
