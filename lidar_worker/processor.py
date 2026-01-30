import json
import pdal
import numpy as np
import os

def process_scan(input_path: str, output_dir: str = "/tmp"):
    """
    Processes a .las/.laz file using PDAL.
    1. Reads file.
    2. Filters outliers (SOR).
    3. Classifies Ground (SMRF).
    4. Generates a DEM (Digital Elevation Model).
    """
    
    filename = os.path.basename(input_path)
    dem_path = os.path.join(output_dir, f"{filename}_dem.tif")
    
    # PDAL Pipeline Definition
    pipeline_json = {
        "pipeline": [
            {
                "type": "readers.las",
                "filename": input_path
            },
            {
                "type": "filters.outlier",
                "method": "statistical",
                "mean_k": 8,
                "multiplier": 3.0
            },
            {
                "type": "filters.smrf",
                "ignore": "Classification[7:7]", # Ignore existing noise
                "slope": 0.2,
                "window": 18,
                "threshold": 0.5,
                "scalar": 1.25
            },
            {
                "type": "filters.range",
                "limits": "Classification[2:2]" # Keep only Ground (Class 2)
            },
            {
                "type": "writers.gdal",
                "filename": dem_path,
                "resolution": 1.0, # 1 meter per pixel
                "output_type": "mean",
                "radius": 1.5
            }
        ]
    }

    try:
        pipeline = pdal.Pipeline(json.dumps(pipeline_json))
        count = pipeline.execute()
        arrays = pipeline.arrays
        metadata = pipeline.metadata
        
        # In a real scenario, we would parse the TIF to JSON here or return the TIF url.
        # For this prototype, we return metadata.
        return {
            "status": "success",
            "point_count": count,
            "dem_path": dem_path,
            "metadata": metadata
        }
        
    except Exception as e:
        return {
            "status": "error",
            "message": str(e)
        }
