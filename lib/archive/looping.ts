import * as cdk from 'aws-cdk-lib';
import { aws_s3 as s3 } from 'aws-cdk-lib';


export class CdkPipelinesStack extends cdk.Stack {
  constructor(scope: cdk.App, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    for (var val of [1, 2, 3]) {
      // Hi Ivo, here you find some more info for looping, dumbass:
      // https://www.tutorialsteacher.com/typescript/for-loop
      new s3.Bucket(this, 'sample_bucket_' + val + '_nn_data_pipelines', {
        versioned: true,
        removalPolicy: cdk.RemovalPolicy.DESTROY,
        autoDeleteObjects: true,
        bucketName: 'sample-bucket-' + val + '-nn-data-pipelines'
      });
    }
  }
}