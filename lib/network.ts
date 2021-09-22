import * as cdk from '@aws-cdk/core'
import * as ec2 from '@aws-cdk/aws-ec2'
import * as acm from "@aws-cdk/aws-certificatemanager"
import * as alb from '@aws-cdk/aws-elasticloadbalancingv2'

export class Network extends cdk.Stack {
  public readonly vpc: ec2.IVpc
  public readonly apiToDBSG: ec2.ISecurityGroup
  public readonly dbSG: ec2.ISecurityGroup
  public readonly aLBListener: alb.IApplicationListener

  constructor(scope: cdk.Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props)
    const vpc = new ec2.Vpc(this, 'EcsRailsSampleVPC', {
      subnetConfiguration: [
         {
           cidrMask: 24,
           name: 'public',
           subnetType: ec2.SubnetType.PUBLIC,
         },
         {
          cidrMask: 24,
          name: 'application',
          subnetType: ec2.SubnetType.PRIVATE_WITH_NAT,
        },
         {
           cidrMask: 28,
           name: 'rds',
           subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
         }
      ]
    })
    this.vpc = vpc

    const lb = new alb.ApplicationLoadBalancer(this, 'EcsRailsSampleALB', {
      vpc,
      internetFacing: true,
      deletionProtection: true
    })

    //const cert = new acm.Certificate(this, "EcsRailsSampleALBCertificate", {
    //  domainName: "",
    //  validation: acm.CertificateValidation.fromDns(""),
    //})

    const listener = lb.addListener('EcsRailsSampleALBPublicListener', {
      port: 80,
      open: true,
    })
    this.aLBListener = listener
    
    const apiToDBSG = new ec2.SecurityGroup(this, 'API to DB',{
      vpc,
    })
    const dbSG = new ec2.SecurityGroup(this, 'DB',{
      vpc,
    })
    // DBへのアクセス
    dbSG.addIngressRule(
      dbSG,
      ec2.Port.tcp(3306),
      'allow db connection'
    )
    dbSG.addIngressRule(
      apiToDBSG,
      ec2.Port.tcp(3306),
      'allow ec2 connection'
    )
    this.apiToDBSG = apiToDBSG
    this.dbSG = dbSG
    new cdk.CfnOutput(this, "LoadBalancerDNS", {
      value: lb.loadBalancerDnsName,
    })
  }
}

