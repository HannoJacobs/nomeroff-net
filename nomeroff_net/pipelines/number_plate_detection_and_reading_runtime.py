from nomeroff_net.pipelines.number_plate_detection_and_reading import NumberPlateDetectionAndReading
from nomeroff_net.pipelines.number_plate_detection_and_reading_v2 import NumberPlateDetectionAndReadingV2
from nomeroff_net.pipelines.base import RuntimePipeline


class NumberPlateDetectionAndReadingRuntime(NumberPlateDetectionAndReading, RuntimePipeline):
    """
    Number Plate Detection and reading runtime
    """

    def __init__(self, *args, **kwargs):
        NumberPlateDetectionAndReading.__init__(self, *args, **kwargs)
        RuntimePipeline.__init__(self, [])
