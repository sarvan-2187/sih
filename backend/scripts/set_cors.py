import os
import subprocess
import json
from dotenv import load_dotenv

load_dotenv()

B2_KEY_ID = os.getenv("B2_KEY_ID")
B2_APPLICATION_KEY = os.getenv("B2_APPLICATION_KEY")
B2_BUCKET_NAME = os.getenv("B2_BUCKET_NAME", "qrious-resources-bucket")

def run_command(cmd, env=None):
    if env is None:
        env = os.environ.copy()
        # B2 CLI gets confused if it sees B2_APPLICATION_KEY without B2_APPLICATION_KEY_ID
        if "B2_APPLICATION_KEY" in env:
            del env["B2_APPLICATION_KEY"]
            
    result = subprocess.run(cmd, env=env, capture_output=True, text=True, shell=True)
    if result.returncode != 0:
        print(f"Error running command: {cmd}")
        print(f"STDOUT: {result.stdout}")
        print(f"STDERR: {result.stderr}")
        raise Exception("Command failed")
    return result.stdout

def main():
    print("Authorizing B2 CLI...")
    run_command(f'venv\\Scripts\\b2.exe account authorize "{B2_KEY_ID}" "{B2_APPLICATION_KEY}"')
    
    cors_rules = [
        {
            "corsRuleName": "allow-everything",
            "allowedOrigins": [
                "http://localhost:5173",
                "https://schrodinger-squad.vercel.app"
            ],
            "allowedHeaders": [
                "*"
            ],
            "allowedOperations": [
                "b2_download_file_by_id",
                "b2_download_file_by_name",
                "b2_upload_file",
                "b2_upload_part",
                "s3_put",
                "s3_post",
                "s3_get",
                "s3_head"
            ],
            "exposeHeaders": [
                "x-bz-content-sha1"
            ],
            "maxAgeSeconds": 3600
        }
    ]
    
    rules_json = json.dumps(cors_rules).replace('"', '\\"')
    
    run_command(f'venv\\Scripts\\b2.exe bucket update --cors-rules "{rules_json}" {B2_BUCKET_NAME}')
    print("Successfully forced Backblaze B2 CORS rules via Native API!")

if __name__ == "__main__":
    main()
