import os
import shutil
from contextlib import asynccontextmanager
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from ultralytics import YOLO

MODEL_PATH = os.path.join(os.path.dirname(__file__), "models", "safaai_best.pt")
model = None

REMARKS = {
    "overflowing_bin": "Bin overflow detected. Immediate collection required.",
    "dead_animal": "Dead animal identified. HIGH priority — escalated to Animal Husbandry Dept.",
    "medical_waste": "Medical/biohazard waste detected. Priority handling needed.",
    "construction_debris": "Construction debris found. Standard collection scheduled.",
    "illegal_dumping": "Illegal dumping detected. Flagged for enforcement review.",
    "garbage_pile": "Garbage accumulation detected. Added to collection queue.",
}

@asynccontextmanager
async def lifespan(app: FastAPI):
    global model
    if os.path.exists(MODEL_PATH):
        try:
            model = YOLO(MODEL_PATH)
            print(f"Model loaded successfully from {MODEL_PATH}")
        except Exception as e:
            print(f"Error loading model: {e}")
    else:
        print(f"Warning: Model file not found at {MODEL_PATH}. Inference will fail.")
    yield
    # Cleanup if needed
    model = None

app = FastAPI(title="Safaai Sarathi Vision API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
async def root():
    return {"status": "ok", "message": "Safaai Sarathi Vision API is running."}

@app.post("/api/classify-waste")
async def classify_waste(file: UploadFile = File(...)):
    if model is None:
        raise HTTPException(status_code=503, detail="AI Model is not loaded. Please check the models directory.")
    
    temp_file_path = f"temp_{file.filename}"
    try:
        with open(temp_file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
            
        results = model(temp_file_path, conf=0.25)
        
        if not results or len(results[0].boxes) == 0:
            return {
                "status": "no_detection",
                "predicted_category": None,
                "confidence": 0,
                "needs_manual_review": True,
                "remark": "No specific waste category detected. Please select manually."
            }
            
        best_box = None
        best_conf = 0
        
        for box in results[0].boxes:
            conf = float(box.conf[0])
            if conf > best_conf:
                best_conf = conf
                best_box = box
                
        if best_box is None:
            return {
                "status": "no_detection",
                "predicted_category": None,
                "confidence": 0,
                "needs_manual_review": True,
                "remark": "No specific waste category detected. Please select manually."
            }
            
        class_id = int(best_box.cls[0])
        class_name = model.names[class_id]
        confidence_pct = round(best_conf * 100, 2)
        needs_review = confidence_pct < 70.0
        
        remark = REMARKS.get(class_name, "Waste detected. Standard handling required.")
        
        return {
            "status": "success",
            "predicted_category": class_name,
            "confidence": confidence_pct,
            "needs_manual_review": needs_review,
            "remark": remark
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        if os.path.exists(temp_file_path):
            os.remove(temp_file_path)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8100, reload=True)
