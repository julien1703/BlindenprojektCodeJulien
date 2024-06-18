import RPi.GPIO as GPIO
import time
import requests

class CapacitiveSensor:
    def __init__(self, send_pin, receive_pin):
        self.send_pin = send_pin
        self.receive_pin = receive_pin
        self.error = 1
        self.loop_timing_factor = 310
        self.CS_Timeout_Millis = (2000 * self.loop_timing_factor * 16e6) / 16e6
        self.CS_AutocaL_Millis = 20000

        GPIO.setmode(GPIO.BCM)
        GPIO.setup(self.send_pin, GPIO.OUT)
        GPIO.setup(self.receive_pin, GPIO.IN)
        GPIO.output(self.send_pin, GPIO.LOW)

        self.least_total = 0x0FFFFFFF
        self.last_cal = time.time() * 1000

    def capacitive_sensor(self, samples):
        self.total = 0
        if samples == 0:
            return 0
        if self.error < 0:
            return -1

        for _ in range(samples):
            if self.sense_one_cycle() < 0:
                return -2

        diff = abs(self.total - self.least_total)
        if (time.time() * 1000 - self.last_cal > self.CS_AutocaL_Millis) and diff < int(0.10 * self.least_total):
            self.least_total = 0x0FFFFFFF
            self.last_cal = time.time() * 1000

        if self.total < self.least_total:
            self.least_total = self.total

        return self.total - self.least_total

    def capacitive_sensor_raw(self, samples):
        self.total = 0
        if samples == 0:
            return 0
        if self.error < 0:
            return -1

        for _ in range(samples):
            if self.sense_one_cycle() < 0:
                return -2

        return self.total

    def reset_CS_AutoCal(self):
        self.least_total = 0x0FFFFFFF

    def set_CS_AutocaL_Millis(self, autoCal_millis):
        self.CS_AutocaL_Millis = autoCal_millis

    def set_CS_Timeout_Millis(self, timeout_millis):
        self.CS_Timeout_Millis = (timeout_millis * self.loop_timing_factor * 16e6) / 16e6

    def sense_one_cycle(self):
        self.total = 0
        GPIO.setup(self.receive_pin, GPIO.OUT)
        GPIO.output(self.receive_pin, GPIO.LOW)
        time.sleep(10e-6)
        GPIO.setup(self.receive_pin, GPIO.IN)
        GPIO.output(self.send_pin, GPIO.HIGH)

        start_time = time.time()
        while not GPIO.input(self.receive_pin) and self.total < self.CS_Timeout_Millis:
            self.total += 1
            if time.time() - start_time > self.CS_Timeout_Millis / 1e6:
                return -2

        GPIO.setup(self.receive_pin, GPIO.OUT)
        GPIO.output(self.receive_pin, GPIO.HIGH)
        GPIO.setup(self.receive_pin, GPIO.IN)
        GPIO.output(self.send_pin, GPIO.LOW)

        start_time = time.time()
        while GPIO.input(self.receive_pin) and self.total < self.CS_Timeout_Millis:
            self.total += 1
            if time.time() - start_time > self.CS_Timeout_Millis / 1e6:
                return -2

        if self.total >= self.CS_Timeout_Millis:
            return -2
        else:
            return 1

# Example usage
if __name__ == "__main__":
    # Define the GPIO pins
    send_pin = 17  # GPIO pin connected to the send pin
    receive_pin = 18  # GPIO pin connected to the receive pin

    # Create an instance of the CapacitiveSensor class
    sensor = CapacitiveSensor(send_pin, receive_pin)
    mode = 1  # Start in mode 1

    try:
        while True:
            # Read the capacitive sensor value
            value = sensor.capacitive_sensor(10)
            print(f"Capacitive Sensor Value: {value}")

            if value > threshold:  # Define an appropriate threshold for touch detection
                mode = 2 if mode == 1 else 1
                response = requests.post("http://127.0.0.1:3000/mode", json={"mode": mode})
                print(f"Mode switched to: {mode}")
            
            # Wait a bit before reading again
            time.sleep(0.5)
    except KeyboardInterrupt:
        print("Program stopped by User")
    finally:
        # Cleanup the GPIO pins before exiting
        GPIO.cleanup()
