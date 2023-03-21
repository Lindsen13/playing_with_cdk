import * as cdk from 'aws-cdk-lib';
import {
  aws_stepfunctions_tasks as tasks,
  aws_events_targets as targets,
  aws_stepfunctions as sfn,
  aws_events as events,
  aws_lambda as lambda,
  aws_s3 as s3
} from 'aws-cdk-lib'

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
      code: lambda.Code.fromAsset('src/stepfunctions_v2/5_load_data/'),
      handler: 'main.handler',
      environment: { 'source_bucket': CuratedBucket.bucketName, 'destination_bucket': '' },
      description: 'Lambda that runs Cyper statements and inserts data into Neo4j'
    });

    // Function to transform data and stores into the staging bucket
    const CalculdateCDC = new lambda.Function(this, 'calculate_cdc', {
      runtime: lambda.Runtime.PYTHON_3_9,
      code: lambda.Code.fromAsset('src/stepfunctions_v2/4_calculate_cdc'),
      handler: 'main.handler',
      environment: { 'source_bucket': StagingBucket.bucketName, 'destination_bucket': CuratedBucket.bucketName },
      description: 'Lambda that calculates changes in the  data and places it into the curated bucket',
    });

    // Function to run data quality checks on the data
    const QualityCheck = new lambda.Function(this, 'quality_check', {
      runtime: lambda.Runtime.PYTHON_3_9,
      code: lambda.Code.fromAsset('src/stepfunctions_v2/3_quality_check'),
      handler: 'main.handler',
      environment: { 'source_bucket': StagingBucket.bucketName, 'destination_bucket': '' },
      description: 'Lambda that runs data quality checks',
    });

    // Function to transform data and stores into the staging bucket
    const TransformData = new lambda.Function(this, 'transform_data', {
      runtime: lambda.Runtime.PYTHON_3_9,
      code: lambda.Code.fromAsset('src/stepfunctions_v2/2_transform_data'),
      handler: 'main.handler',
      environment: { 'source_bucket': RawBucket.bucketName, 'destination_bucket': StagingBucket.bucketName },
      description: 'Lambda that transforms data and places it into the staging bucket',
    });

    // Function to validate data and stores into the raw bucket
    const ValidateData = new lambda.Function(this, 'validate_data', {
      runtime: lambda.Runtime.PYTHON_3_9,
      code: lambda.Code.fromAsset('src/stepfunctions_v2/1_validate_data'),
      handler: 'main.handler',
      environment: { 'source_bucket': SourceBucket.bucketName, 'destination_bucket': RawBucket.bucketName },
      description: 'Lambda that validates data and places it into the raw bucket',
    });

    // Function to fetch and store data into source
    const FetchData = new lambda.Function(this, 'fetch_data', {
      runtime: lambda.Runtime.PYTHON_3_9,
      code: lambda.Code.fromAsset('src/stepfunctions_v2/0_fetch_data'),
      handler: 'main.handler',
      environment: { 'source_bucket': '', 'destination_bucket': SourceBucket.bucketName },
      description: 'Lambda that fetches data from a datasource and places it into the source bucket',
    });

    // Add proper accesses to the buckets.
    SourceBucket.grantReadWrite(FetchData);
    SourceBucket.grantRead(ValidateData);
    RawBucket.grantReadWrite(ValidateData);
    RawBucket.grantRead(TransformData);
    StagingBucket.grantReadWrite(TransformData);
    StagingBucket.grantRead(QualityCheck);
    StagingBucket.grantRead(CalculdateCDC);
    CuratedBucket.grantReadWrite(CalculdateCDC);
    CuratedBucket.grantRead(LoadData);

    // Step 1: Fetch data
    const FetchDataTask = new tasks.LambdaInvoke(this, 'fetch_data_task', {
      lambdaFunction: FetchData
    });

    const DataArrivedInSource = new sfn.Pass(this, 'Data_arrived_in_source_bucket');

    // Step 2: Validate Data
    const ValidateDataTask = new tasks.LambdaInvoke(this, 'validate_data_task', {
      lambdaFunction: ValidateData
    });

    const DataValidated = new sfn.Pass(this, 'Data_validated');
    
    // Step 3: Transform Data
    const TransformDataTask = new tasks.LambdaInvoke(this, 'transform_data_task', {
      lambdaFunction: TransformData
    });

    const DataTransformed = new sfn.Pass(this, 'Data_transformed');
    
    // Step 4: Quality Check Data
    const QualityCheckTask = new tasks.LambdaInvoke(this, 'quality_check_data_task', {
      lambdaFunction: TransformData
    });

    const QualityChecked = new sfn.Pass(this, 'Data_quality_checked');
    
    // Step 5: Calculate CDC
    const CalculdateCDCTask = new tasks.LambdaInvoke(this, 'calculate_cdc_task', {
      lambdaFunction: CalculdateCDC
    });

    const CDCCalculated = new sfn.Pass(this, 'CDC_Calculated');
    
    // Step 6: Calculate CDC
    const LoadDataTask = new tasks.LambdaInvoke(this, 'load_data_task', {
      lambdaFunction: LoadData
    });

    const DataLoaded = new sfn.Pass(this, 'Data_loaded');

    // Arranging steps in correct order
    const definition = FetchDataTask
      .next(DataArrivedInSource)
      .next(ValidateDataTask)
      .next(DataValidated)
      .next(TransformDataTask)
      .next(DataTransformed)
      .next(QualityCheckTask)
      .next(QualityChecked)
      .next(CalculdateCDCTask)
      .next(CDCCalculated)
      .next(LoadDataTask)
      .next(DataLoaded)

    // Create a Stepfunction statemachine with the assigned order of steps:
    const StateMachineSamplePipeline = new sfn.StateMachine(this, 'StateMachineSamplePipeline', {
      definition
    });

    // Create a cronn event to happen every minute (can be found in event bridge rules)
    const CronnEvent = new events.Rule(this, 'Rule', {
      schedule: events.Schedule.expression('cron(0/15 * * * ? *)'),
    });

    // Add cronn event to the Stepfunction state machine
    CronnEvent.addTarget(new targets.SfnStateMachine(StateMachineSamplePipeline));
  }
}

