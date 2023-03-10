import * as cdk from 'aws-cdk-lib';
import { aws_s3 as s3 } from 'aws-cdk-lib';
import { aws_ecs as ecs } from 'aws-cdk-lib';
import { aws_ecs_patterns as ecs_patterns } from 'aws-cdk-lib';


export class CdkPipelinesStack extends cdk.Stack {
    constructor(scope: cdk.App, id: string, props?: cdk.StackProps) {
        super(scope, id, props);

        // We'll be creating a ECS service with a fargate container running
        // a simple python task to save data to a s2 bucket

        // Creating a cluster
        const cluster = new ecs.Cluster(this, "ecs-cluster");

        // Add a service to the cluster
        const fargate = new ecs_patterns.ApplicationLoadBalancedFargateService(this, 'MyFargateService', {
            cluster: cluster,
            cpu: 512,
            desiredCount: 1,
            taskImageOptions: {
                image: ecs.ContainerImage.fromAsset('src/fargate/'),
                environment: {
                    "name": "Serverless Fargate",
                },
            },
            memoryLimitMiB: 2048,
        });
    }
}