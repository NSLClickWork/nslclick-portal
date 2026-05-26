import cv2
import os
import glob
import urllib.request
import numpy as np

# Download haarcascade if not exists
cascade_path = 'haarcascade_frontalface_default.xml'
if not os.path.exists(cascade_path):
    url = 'https://raw.githubusercontent.com/opencv/opencv/master/data/haarcascades/haarcascade_frontalface_default.xml'
    urllib.request.urlretrieve(url, cascade_path)

face_cascade = cv2.CascadeClassifier(cascade_path)

input_dir = 'd:/NSLClick-Huber/NSL_Candidate_Setcards'
output_dir = 'd:/NSLClick-Huber/public/photos'

if not os.path.exists(output_dir):
    os.makedirs(output_dir)

# Try to find faces and crop
success_count = 0
fail_count = 0

for file_path in glob.glob(os.path.join(input_dir, '*.*')):
    if not file_path.lower().endswith(('.png', '.jpg', '.jpeg')):
        continue
    
    filename = os.path.basename(file_path)
    
    # Read image
    img = cv2.imread(file_path)
    if img is None:
        continue
        
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    
    # Detect faces
    faces = face_cascade.detectMultiScale(gray, scaleFactor=1.1, minNeighbors=5, minSize=(100, 100))
    
    if len(faces) > 0:
        # Get the largest face
        faces = sorted(faces, key=lambda x: x[2]*x[3], reverse=True)
        x, y, w, h = faces[0]
        
        # Add padding (e.g. 50%)
        pad_x = int(w * 0.4)
        pad_y = int(h * 0.5)
        
        x1 = max(0, x - pad_x)
        y1 = max(0, y - int(pad_y * 1.2)) # more space above head
        x2 = min(img.shape[1], x + w + pad_x)
        y2 = min(img.shape[0], y + h + int(pad_y * 0.8))
        
        cropped = img[y1:y2, x1:x2]
        
        # Make it square
        h_c, w_c = cropped.shape[:2]
        size = min(h_c, w_c)
        cy, cx = h_c // 2, w_c // 2
        
        y1_sq = cy - size // 2
        y2_sq = cy + size // 2
        x1_sq = cx - size // 2
        x2_sq = cx + size // 2
        
        square_crop = cropped[y1_sq:y2_sq, x1_sq:x2_sq]
        
        # Resize to 300x300 for uniformity
        final_img = cv2.resize(square_crop, (300, 300))
        
        out_path = os.path.join(output_dir, filename)
        cv2.imwrite(out_path, final_img)
        success_count += 1
    else:
        # Fallback if no face detected: just crop the top right or center
        # For setcards, the face is often in a specific spot. Let's just crop top right for now
        h, w = img.shape[:2]
        # Assuming face is in top right quadrant roughly
        crop_w = int(w * 0.3)
        crop_h = int(w * 0.3)
        x1 = w - crop_w - 50
        y1 = 50
        if x1 > 0 and y1 > 0 and x1+crop_w < w and y1+crop_h < h:
            fallback_crop = img[y1:y1+crop_h, x1:x1+crop_w]
            final_img = cv2.resize(fallback_crop, (300, 300))
            out_path = os.path.join(output_dir, filename)
            cv2.imwrite(out_path, final_img)
        fail_count += 1

print(f"Done! Successfully detected faces in {success_count} images. Fallbacks used for {fail_count} images.")
