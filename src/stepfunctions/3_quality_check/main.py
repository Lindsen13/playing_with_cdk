import os
import logging
import boto3
import tempfile
import random

logger = logging.getLogger()
logger.setLevel(logging.INFO)

def handler(event, context):
    if random.randint(0,2)==1:
        raise ValueError(r"This function fails 50% of the time!")
    else:
        logger.info('I did not fail this time :-)')
    source_bucket = os.environ.get("source_bucket", None)
    destination_bucket = os.environ.get("destination_bucket", None)
    logger.info(f'{source_bucket=}, {destination_bucket=}')
    
    filename = event.get('Payload',[])[-1].get("output_file", None)
    if not filename:
        raise ValueError(f"File is not specified: {event=}")
    
    s3_client = boto3.client("s3")
    with tempfile.TemporaryFile() as temp_file:
        s3_client.download_fileobj(source_bucket, filename, temp_file)
        temp_file.seek(0)
        payload = temp_file.read().decode("utf-8")
    
    s3_client.put_object(
        Body=f"This is done in the 4th step!\n{payload}",
        Bucket=destination_bucket,
        Key=filename,
    )
    return 200, {"Status":"Done","output_file":filename,"input_file":filename}
