import * as cdk from '@aws-cdk/core'
import * as ec2 from '@aws-cdk/aws-ec2'
import * as s3 from '@aws-cdk/aws-s3'
import * as ecs from '@aws-cdk/aws-ecs'
import * as iam from '@aws-cdk/aws-iam'
import * as logs from '@aws-cdk/aws-logs'
import * as destinations from '@aws-cdk/aws-kinesisfirehose-destinations'
import * as firehoses from '@aws-cdk/aws-kinesisfirehose'
import * as ecr from '@aws-cdk/aws-ecr'
import * as ssm from '@aws-cdk/aws-ssm'
import * as alb from '@aws-cdk/aws-elasticloadbalancingv2'
import * as secrets from '@aws-cdk/aws-secretsmanager'
import { ApplicationLoadBalancedFargateService } from '@aws-cdk/aws-ecs-patterns'
// https://aws.amazon.com/jp/blogs/containers/general-availability-amazon-ecs-service-extensions-for-aws-cdk/
// あとで検討する
import { XRayExtension, CloudwatchAgentExtension } from '@aws-cdk-containers/ecs-service-extensions'

interface APIStackProps extends cdk.StackProps {
  vpc: ec2.IVpc
  apiToDBSG: ec2.ISecurityGroup
  apiALBListener: alb.IApplicationListener
}

export class API extends cdk.Stack {
  constructor(scope: cdk.Construct, id: string, props: APIStackProps) {
    super(scope, id, props)

    const vpc = props.vpc

    // kinesis firehose
    // これだと5分間バッファリングする
    //const bucket = new s3.Bucket(this, 'Bucket');
    //const firehose = new firehoses.DeliveryStream(this, 'Delivery Stream', {
    //  destinations: [new destinations.S3Bucket(bucket)],
    //})

    // Create ECS Cluster
    const cluster = new ecs.Cluster(this, 'EcsRailsSampleECSCLuster', {
      vpc,
      clusterName: "EcsRailsSample",
      containerInsights: true // https://aws.amazon.com/jp/cloudwatch/pricing/
    })

    const repository = ecr.Repository.fromRepositoryName(
      this,
      'EcsRailsSampleRepository',
      'ecs-rails-sample'
    )

    // IAM Role
    const executionRole = new iam.Role(this, 'EcsRailsSampleECSExecutionRole', {
      roleName: 'ecs-rails-sample-execution-role',
      assumedBy: new iam.ServicePrincipal('ecs-tasks.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('CloudWatchAgentServerPolicy'),
        iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AmazonECSTaskExecutionRolePolicy'),
      ],
    })

    const apiServiceTaskRole = new iam.Role(this, 'EcsRailsSampleECSServiceTaskRole', {
      roleName: 'ecs-rails-sample-service-task-role',
      assumedBy: new iam.ServicePrincipal('ecs-tasks.amazonaws.com'),
    })

    const apiTaskDef = new ecs.FargateTaskDefinition(this, "EcsRailsSampleTaskDefinition", {
      family: 'ecs-rails-sample-api',
      memoryLimitMiB: 8192,
      cpu: 4096,
      executionRole: executionRole,
      taskRole: apiServiceTaskRole,
    })

    const logGroup = new logs.LogGroup(this, 'EcsRailsSampleLogGroup', {
      logGroupName: '/ecs/ecs-rails-sample-api',
      removalPolicy: cdk.RemovalPolicy.DESTROY // 今回は消す設定にする
    })
    const xrayLogGroup = new logs.LogGroup(this, 'EcsRailsSampleXRayLogGroup', {
      logGroupName: '/ecs/ecs-rails-sample-xray',
      removalPolicy: cdk.RemovalPolicy.DESTROY // 今回は消す設定にする
    })
    const cWLogGroup = new logs.LogGroup(this, 'EcsRailsSampleCloudWatchLogGroup', {
      logGroupName: '/ecs/ecs-rails-sample-cloudwatch',
      removalPolicy: cdk.RemovalPolicy.DESTROY // 今回は消す設定にする
    })

    const containerDef = apiTaskDef.addContainer('EcsRailsSampleContainerDefinition', {
      containerName: "API",
      image: ecs.ContainerImage.fromEcrRepository(repository, this.node.tryGetContext("AppTag")),
      memoryLimitMiB: 8192 - 256 - 50,
      memoryReservationMiB: 8192 - 256 - 50,
      environment: {
        APP_STAGE: "live_production1",
        RAILS_ENV: "production",
        // https://github.com/cookpad/aws-xray#rails-app
        AWS_XRAY_LOCATION: "localhost:2000"
      },
      secrets: {
        RAILS_MASTER_KEY: ecs.Secret.fromSecretsManager(
          secrets.Secret.fromSecretCompleteArn(this, "EcsRailsSampleSecret", this.node.tryGetContext("EcsRailsSampleSecretArn")),
          "RAILS_MASTER_KEY"
          ),
      },
      logging: ecs.LogDrivers.awsLogs({
        streamPrefix: "EcsRailsSample",
        logGroup
      }),
    })
    containerDef.addPortMappings({
      containerPort: 3000
    })

    // https://docs.aws.amazon.com/ja_jp/AmazonCloudWatch/latest/monitoring/deploy_servicelens_CloudWatch_agent_deploy_ECS.html
    // コンテナ定義のCPUの設定について https://docs.aws.amazon.com/ja_jp/AmazonECS/latest/developerguide/task_definition_parameters.html#container_definition_environment
    // https://github.com/aws/aws-cdk/blob/master/packages/%40aws-cdk-containers/ecs-service-extensions/lib/extensions/xray.ts
    apiTaskDef.addContainer('xray', {
      image: ecs.ContainerImage.fromRegistry('public.ecr.aws/xray/aws-xray-daemon:latest'),
      essential: false,
      memoryReservationMiB: 256,
      healthCheck: {
          command: [
              'CMD-SHELL',
              'curl -s http://localhost:2000',
          ],
          startPeriod: cdk.Duration.seconds(10),
          interval: cdk.Duration.seconds(5),
          timeout: cdk.Duration.seconds(2),
          retries: 3,
      },
      logging: new ecs.AwsLogDriver({
        streamPrefix: 'xray',
        logGroup: xrayLogGroup
      }),
      user: '1337',
    })
    apiTaskDef.taskRole.addManagedPolicy(iam.ManagedPolicy.fromAwsManagedPolicyName('AWSXRayDaemonWriteAccess'))

    // https://github.com/aws/aws-cdk/blob/master/packages/%40aws-cdk-containers/ecs-service-extensions/lib/extensions/cloudwatch-agent.ts
    const CW_CONFIG_CONTENT = {
      logs: {
        metrics_collected: {
          emf: {},
        },
      },
      metrics: {
        metrics_collected: {
          statsd: {},
        },
      },
    }
    apiTaskDef.addContainer('cloudwatch-agent', {
      image: ecs.ContainerImage.fromRegistry('public.ecr.aws/cloudwatch-agent/cloudwatch-agent:latest'),
      essential: false,
      environment: {
        CW_CONFIG_CONTENT: JSON.stringify(CW_CONFIG_CONTENT),
      },
      logging: new ecs.AwsLogDriver({
        streamPrefix: 'cloudwatch-agent',
        logGroup: cWLogGroup
      }),
      user: '0:1338', // Ensure that CloudWatch agent outbound traffic doesn't go through proxy
      memoryReservationMiB: 50,
    })
    apiTaskDef.taskRole.addManagedPolicy(iam.ManagedPolicy.fromAwsManagedPolicyName('CloudWatchAgentServerPolicy'))

    // サーキットブレーカー https://aws.amazon.com/jp/blogs/news/announcing-amazon-ecs-deployment-circuit-breaker-jp/
    // https://github.com/aws/aws-cdk/tree/master/design/aws-ecs
    const service = new ecs.FargateService(this, 'EcsRailsSampleService', {
      serviceName: "EcsRailsSampleAPI",
      cluster,
      vpcSubnets: vpc.selectSubnets({ subnetType: ec2.SubnetType.PRIVATE_WITH_NAT }),
      securityGroup: props.apiToDBSG,
      taskDefinition: apiTaskDef,
      desiredCount: 4,
      maxHealthyPercent: 200,
      minHealthyPercent: 50,
      healthCheckGracePeriod: cdk.Duration.seconds(30),
      capacityProviderStrategies: [
        {capacityProvider: 'FARGATE_SPOT', weight: 1},
        {capacityProvider: 'FARGATE', weight: 1},
      ]
    })

    // Attach ALB to ECS Service
    props.apiALBListener.addTargets('EcsRailsSampleTarget', {
      protocol: alb.ApplicationProtocol.HTTP,
      targets: [
        service.loadBalancerTarget({
          containerName: 'API',
          containerPort: 3000
        })
      ],
      healthCheck: {
        interval: cdk.Duration.seconds(10),
        path: "/healthz",
        timeout: cdk.Duration.seconds(4),
        protocol: alb.Protocol.HTTP,
        healthyHttpCodes: '200',
        healthyThresholdCount: 2,
        unhealthyThresholdCount: 3,
      }
    })

    // DBスキーマ変更するためのインスタンス
    const dbExecServiceTaskRole = new iam.Role(this, 'EcsRailsSampleDbExecServiceTaskRole', {
      roleName: 'ecs-rails-sample-db-exec-task-role',
      assumedBy: new iam.ServicePrincipal('ecs-tasks.amazonaws.com'),
    })

    dbExecServiceTaskRole.addToPrincipalPolicy(new iam.PolicyStatement({
      actions: [
        'ssmmessages:CreateControlChannel',
        'ssmmessages:CreateDataChannel',
        'ssmmessages:OpenControlChannel',
        'ssmmessages:OpenDataChannel',
      ],
      resources: ['*'],
    }))

    const dbExecTaskDef = new ecs.FargateTaskDefinition(this, "EcsRailsSampleDbExecTaskDefinition", {
      family: 'ecs-rails-sample-db',
      memoryLimitMiB: 8192,
      cpu: 4096,
      executionRole: executionRole,
      taskRole: dbExecServiceTaskRole,
    })

    const dbExecLogGroup = new logs.LogGroup(this, 'EcsRailsSampleDbExecLogGroup', {
      logGroupName: '/ecs/ecs-rails-sample-db-exec',
      removalPolicy: cdk.RemovalPolicy.DESTROY // 今回は消す設定にする
    })

    dbExecTaskDef.addContainer('EcsRailsSampleDbExecContainerDefinition', {
      containerName: "DB",
      image: ecs.ContainerImage.fromEcrRepository(repository, this.node.tryGetContext("AppTag")),
      cpu: 4096,
      memoryLimitMiB: 8192,
      memoryReservationMiB: 8192,
      environment: {
        APP_STAGE: "live_production1",
        RAILS_ENV: "production"
      },
      secrets: {
        RAILS_MASTER_KEY: ecs.Secret.fromSecretsManager(
          secrets.Secret.fromSecretCompleteArn(this, "EcsRailsSampleDbExecSecret", this.node.tryGetContext("EcsRailsSampleSecretArn")),
          "RAILS_MASTER_KEY"
          ),
      },
      logging: ecs.LogDrivers.awsLogs({
        streamPrefix: "EcsRailsSampleDbExec",
        logGroup: dbExecLogGroup
      }),
    })

    const dbExecService = new ecs.FargateService(this, 'EcsRailsSampleDbExecService', {
      serviceName: "EcsRailsSampleDB",
      cluster,
      vpcSubnets: vpc.selectSubnets({ subnetType: ec2.SubnetType.PRIVATE_WITH_NAT }),
      securityGroup: props.apiToDBSG,
      taskDefinition: dbExecTaskDef,
      desiredCount: 1,
      maxHealthyPercent: 200,
      minHealthyPercent: 50,
      capacityProviderStrategies: [
        {capacityProvider: 'FARGATE_SPOT', weight: 1},
      ],
      enableExecuteCommand: true
    })
  }
}