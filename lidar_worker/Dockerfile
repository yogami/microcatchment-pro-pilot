FROM continuumio/miniconda3

WORKDIR /app

# Install PDAL via Conda (Critical for LAS processing)
RUN conda install -c conda-forge pdal python-pdal -y

# Copy requirements and install pip packages
COPY requirements.txt .
RUN pip install -r requirements.txt

# Copy source code
COPY . .

# Expose port
EXPOSE 8000

# Run FastAPI
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
