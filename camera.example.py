import time
import requests
from picamera2 import Picamera2

def capture_and_send_image():
    picam2 = Picamera2()
    camera_config = picam2.create_still_configuration()
    picam2.configure(camera_config)
    picam2.start()
    time.sleep(2)  # Warten, bis die Kamera startet

    while True:
        print("Capturing image...")
        image_path = "test.jpg"
        picam2.capture_file(image_path)

        # Send image via POST request
        url = "http://127.0.0.1:3000/analyze"
        with open(image_path, 'rb') as img_file:
            files = {'frame': img_file}  # Hier den Feldnamen ändern
            response = requests.post(url, files=files, data={'descriptionLength': 'medium'})

        # Print response status
        print(response.status_code, response.text)

        # Wait for 20 seconds
        time.sleep(20)

if __name__ == "__main__":
    capture_and_send_image()


# stand 6.6.24