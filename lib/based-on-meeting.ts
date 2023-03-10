import * as cdk from 'aws-cdk-lib';
import { aws_s3 as s3 } from 'aws-cdk-lib';
import { aws_lambda as lambda } from 'aws-cdk-lib'
import { LambdaDestination } from 'aws-cdk-lib/aws-lambda-destinations';

export class CdkPipelinesStack extends cdk.Stack {
  constructor(scope: cdk.App, id: string, props?: cdk.StackProps) {
    super(scope, id, props);


    // Source bucket
    const SourceBucket = new s3.Bucket(this, 'source_bucket', {
      versioned: true,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true
    });

    // Raw bucket
    const RawBucket = new s3.Bucket(this, 'raw_bucket', {
      versioned: true,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true
    });

    // Staging Bucket
    const StagingBucket = new s3.Bucket(this, 'staging_bucket', {
      versioned: true,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true
    });

    // Curated Bucket
    const CuratedBucket = new s3.Bucket(this, 'curated_bucket', {
      versioned: true,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true
    });

    // Function to transform data and stores into the staging bucket
    const LoadData = new lambda.Function(this, 'load_data', {
      runtime: lambda.Runtime.PYTHON_3_9,
      code: lambda.Code.fromAsset('src/based_on_meeting/5_load_data/'),
      handler: 'main.handler',
      environment: { 'source_bucket': CuratedBucket.bucketName, 'destination_bucket': '' },
      description: 'Lambda that runs Cyper statements and inserts data into Neo4j'
    });

    // Function to transform data and stores into the staging bucket
    const CalculdateCDC = new lambda.Function(this, 'calculate_cdc', {
      runtime: lambda.Runtime.PYTHON_3_9,
      code: lambda.Code.fromAsset('src/based_on_meeting/4_calculate_cdc'),
      handler: 'main.handler',
      environment: { 'source_bucket': StagingBucket.bucketName, 'destination_bucket': CuratedBucket.bucketName },
      description: 'Lambda that calculates changes in the  data and places it into the curated bucket',
      onSuccess: new LambdaDestination(LoadData)
    });

    // Function to run data quality checks on the data
    const QualityCheck = new lambda.Function(this, 'quality_check', {
      runtime: lambda.Runtime.PYTHON_3_9,
      code: lambda.Code.fromAsset('src/based_on_meeting/3_quality_check'),
      handler: 'main.handler',
      environment: { 'source_bucket': StagingBucket.bucketName, 'destination_bucket': '' },
      description: 'Lambda that runs data quality checks',
      onSuccess: new LambdaDestination(CalculdateCDC)
    });

    // Function to transform data and stores into the staging bucket
    const TransformData = new lambda.Function(this, 'transform_data', {
      runtime: lambda.Runtime.PYTHON_3_9,
      code: lambda.Code.fromAsset('src/based_on_meeting/2_transform_data'),
      handler: 'main.handler',
      environment: { 'source_bucket': RawBucket.bucketName, 'destination_bucket': StagingBucket.bucketName },
      description: 'Lambda that transforms data and places it into the staging bucket',
      onSuccess: new LambdaDestination(QualityCheck)
    });

    // Function to validate data and stores into the raw bucket
    const ValidateData = new lambda.Function(this, 'validate_data', {
      runtime: lambda.Runtime.PYTHON_3_9,
      code: lambda.Code.fromAsset('src/based_on_meeting/1_validate_data'),
      handler: 'main.handler',
      environment: { 'source_bucket': SourceBucket.bucketName, 'destination_bucket': RawBucket.bucketName },
      description: 'Lambda that validates data and places it into the raw bucket',
      onSuccess: new LambdaDestination(TransformData)
    });

    // Function to fetch and store data into source
    const FetchData = new lambda.Function(this, 'fetch_data', {
      runtime: lambda.Runtime.PYTHON_3_9,
      code: lambda.Code.fromAsset('src/based_on_meeting/0_fetch_data'),
      handler: 'main.handler',
      environment: { 'source_bucket': '', 'destination_bucket': SourceBucket.bucketName },
      description: 'Lambda that fetches data from a datasource and places it into the source bucket',
      onSuccess: new LambdaDestination(ValidateData)
    });

    // Add proper accesses to the buckets.
    SourceBucket.grantReadWrite(FetchData);
    SourceBucket.grantRead(ValidateData);
    RawBucket.grantReadWrite(ValidateData);
    RawBucket.grantRead(TransformData);
    StagingBucket.grantReadWrite(TransformData);
    StagingBucket.grantRead(QualityCheck);
    CuratedBucket.grantReadWrite(CalculdateCDC);
    CuratedBucket.grantRead(LoadData);

    // Add proper accesses to the Functions
    LoadData.grantInvoke(CalculdateCDC);
    CalculdateCDC.grantInvoke(QualityCheck);
    QualityCheck.grantInvoke(TransformData);
    TransformData.grantInvoke(ValidateData);
    ValidateData.grantInvoke(FetchData);

  }
}