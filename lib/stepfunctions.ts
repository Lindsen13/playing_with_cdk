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

    // Curated Bucket
    const CuratedBucket = new s3.Bucket(this, 'curated_bucket', {
      versioned: true,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true
    });

    // Function to transform data and stores into the staging bucket
    const LoadData = new lambda.Function(this, 'load_data', {
      runtime: lambda.Runtime.PYTHON_3_9,
      code: lambda.Code.fromAsset('src/stepfunctions/1_load_data'),
      handler: 'main.handler',
      environment: { 'source_bucket': SourceBucket.bucketName, 'destination_bucket': CuratedBucket.bucketName },
      description: 'Lambda that fetches data from the source bucket and stores it into the cureated bucket'
    });

    // Function to fetch and store data into source
    const FetchData = new lambda.Function(this, 'fetch_data', {
      runtime: lambda.Runtime.PYTHON_3_9,
      code: lambda.Code.fromAsset('src/stepfunctions/0_fetch_data'),
      handler: 'main.handler',
      environment: { 'source_bucket': '', 'destination_bucket': SourceBucket.bucketName },
      description: 'Lambda that fetches data and stores it into the source bucket',
    });

    // Add proper accesses to the buckets.
    SourceBucket.grantReadWrite(FetchData);
    SourceBucket.grantReadWrite(LoadData);
    CuratedBucket.grantReadWrite(LoadData);

    // Creating steps for our Step Function State Machine:
    const FetchDataTask = new tasks.LambdaInvoke(this, 'fetch_data_task', {
      lambdaFunction: FetchData
    });

    const DataArrivedInSourceS3 = new sfn.Pass(this, 'Data_arrived_in_source_s3');

    const LoadDataTask = new tasks.LambdaInvoke(this, 'load_data_task', {
      lambdaFunction: LoadData
    });

    const DataArrivedInCurratedS3 = new sfn.Pass(this, 'Data_arrived_in_currated_s3');

    // Arranging steps in correct order
    const definition = FetchDataTask
      .next(DataArrivedInSourceS3)
      .next(LoadDataTask)
      .next(DataArrivedInCurratedS3)

    // Create a Stepfunction statemachine with the assigned order of steps:
    const StepFunctionStateMachine = new sfn.StateMachine(this, 'ExampleStateMachineFromCDK', {
      definition
    });

    // Create a cronn event to happen every minute (can be found in event bridge rules)
    const CronnEvent = new events.Rule(this, 'Rule', {
      schedule: events.Schedule.expression('cron(* * * * ? *)'),
    });

    // Add cronn event to the Stepfunction state machine
    CronnEvent.addTarget(new targets.SfnStateMachine(StepFunctionStateMachine));
  }
}

