from nomeroff_net import pipeline
from nomeroff_net.tools import unzip

nmroff = pipeline("number_plate_detection_and_reading", image_loader="opencv")

(_, _, _, _, _, _, _, _, number_plates) = unzip(
    nmroff(["./data/examples/oneline_images/example1.jpeg"])
)

print(number_plates)
