import os
import logging
import boto3
import random

logger = logging.getLogger()
logger.setLevel(logging.INFO)

def handler(event, context):
    destination_bucket = os.environ.get('destination_bucket',None)
    filename = f'test_{random.randint(1000,9999)}.txt'
    s3_client = boto3.client('s3')
    s3_client.put_object(Body="This is done in the 1st step!", Bucket=destination_bucket, Key=filename)
    return 200, {"Status":"Done","output_file":filename,"input_file":None}