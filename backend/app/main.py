from fastapi import FastAPI

app = FastAPI(title="P-014 Nutrition Agent API", version="0.1.0")


@app.get("/")
def read_root():
    return {"Hello": "World"}


@app.get("/health")
def health():
    return {"status": "ok"}
