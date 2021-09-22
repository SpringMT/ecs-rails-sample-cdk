import * as cdk from '@aws-cdk/core'
import * as ec2 from '@aws-cdk/aws-ec2'
import * as rds from '@aws-cdk/aws-rds'

interface StorageStackProps extends cdk.StackProps {
  vpc: ec2.IVpc
  dbSG: ec2.ISecurityGroup
}

export class Storage extends cdk.Stack {
  constructor(scope: cdk.Construct, id: string, props: StorageStackProps) {
    super(scope, id, props)
    const vpc = props.vpc
    
    const dbuser = 'ecs_rails_sample'
    const dbname = 'ecs_rails_sample_production'
    const engine = rds.DatabaseClusterEngine.auroraMysql({ version: rds.AuroraMysqlEngineVersion.VER_2_09_2 })
    const credentials = rds.Credentials.fromGeneratedSecret(dbuser) // 自動的にパスワード生成してくれる
    const cluster = new rds.DatabaseCluster(this, 'EcsRailsSampleAurora', {
      engine,
      credentials,
      instances: 1, // read replicaの数
      instanceProps: {
        // optional , defaults to t3.medium
        instanceType: ec2.InstanceType.of(ec2.InstanceClass.MEMORY6_GRAVITON, ec2.InstanceSize.LARGE),
        vpcSubnets: {
          subnets: vpc.isolatedSubnets
        },
        vpc,
        enablePerformanceInsights: true,
        deleteAutomatedBackups: true,
        securityGroups: [props.dbSG],
      },
      defaultDatabaseName: dbname,
      // http://blog.father.gedow.net/2016/05/23/amazon-aurora-parameter/
      // https://aws.amazon.com/jp/blogs/news/best-practices-for-amazon-aurora-mysql-database-configuration/
      parameterGroup: new rds.ParameterGroup(this, 'EcsRailsSampleAuroraParameter', {
        engine,
        parameters: {
          character_set_client: 'utf8mb4',
          character_set_server: 'utf8mb4',
          collation_connection: 'utf8mb4_bin',
          collation_server: 'utf8mb4_bin',
          time_zone: 'UTC',
          max_connections: '2000',
          wait_timeout: '5',
          innodb_lock_wait_timeout: '5', // APIのタイムアウト以内にする
          query_cache_type: '0',
          slow_query_log: '1',
          long_query_time: '0.5',
        },
      }),
      removalPolicy: cdk.RemovalPolicy.DESTROY // テスト用なので消す
    })
  }
}