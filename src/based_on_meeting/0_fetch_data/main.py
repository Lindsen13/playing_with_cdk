import os
import logging

logger = logging.getLogger()
logger.setLevel(logging.INFO)

def handler(event, context):
    source_bucket = os.environ.get('source_bucket',None)
    destination_bucket = os.environ.get('destination_bucket',None)
    logger.info(f'{source_bucket=}, {destination_bucket=}')
    