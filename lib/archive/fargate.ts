import * as cdk from 'aws-cdk-lib';
import { aws_s3 as s3 } from 'aws-cdk-lib';
import { aws_ecs as ecs } from 'aws-cdk-lib';
import { aws_ecs_patterns as ecs_patterns } from 'aws-cdk-lib';
import { aws_ec2 as ec2 } from 'aws-cdk-lib'


export class CdkPipelinesStack extends cdk.Stack {
    constructor(scope: cdk.App, id: string, props?: cdk.StackProps) {
        super(scope, id, props);

        // We'll be creating a ECS service with a fargate container running
        // a simple python task to save data to a s2 bucket

        const vpc = new ec2.Vpc(this, 'MyVpc', { maxAzs: 2 });

        // Creating a cluster
        const cluster = new ecs.Cluster(this, "ClusterForPipelines", { vpc: vpc });

        // Create a Fargate Task
        const fargateTask = new ecs.FargateTaskDefinition(this, 'HelloWorldTask');

        const container = fargateTask.addContainer('HelloWorldContainer', {
            image: ecs.ContainerImage.fromAsset('src/fargate/'),
            logging: ecs.LogDriver.awsLogs({
                streamPrefix: 'HelloWorldContainerLogs'
            })
        });
    }
}