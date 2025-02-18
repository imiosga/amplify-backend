import { AwsCredentialIdentityProvider } from '@aws-sdk/types';
import { DefaultDeployedBackendClient } from './deployed_backend_client.js';
import { BackendIdentifier, DeploymentType } from '@aws-amplify/plugin-types';
import { CloudFormationClient } from '@aws-sdk/client-cloudformation';
import {
  BackendOutputClient,
  BackendOutputClientFactory,
} from './backend_output_client_factory.js';
import { S3Client } from '@aws-sdk/client-s3';
import { DeployedResourcesEnumerator } from './deployed-backend-client/deployed_resources_enumerator.js';
import { StackStatusMapper } from './deployed-backend-client/stack_status_mapper.js';
import { ArnGenerator } from './deployed-backend-client/arn_generator.js';
import { ArnParser } from './deployed-backend-client/arn_parser.js';

export enum ConflictResolutionMode {
  LAMBDA = 'LAMBDA',
  OPTIMISTIC_CONCURRENCY = 'OPTIMISTIC_CONCURRENCY',
  AUTOMERGE = 'AUTOMERGE',
}

export enum ApiAuthType {
  API_KEY = 'API_KEY',
  AWS_LAMBDA = 'AWS_LAMBDA',
  AWS_IAM = 'AWS_IAM',
  OPENID_CONNECT = 'OPENID_CONNECT',
  AMAZON_COGNITO_USER_POOLS = 'AMAZON_COGNITO_USER_POOLS',
}

export type SandboxMetadata = {
  name: string;
  lastUpdated: Date | undefined;
  status: BackendDeploymentStatus;
  backendId: BackendIdentifier | undefined;
};

export type ListSandboxesRequest = {
  nextToken?: string;
};

export type DeployedBackendResource = {
  logicalResourceId?: string;
  lastUpdated?: Date;
  resourceStatus?: string;
  resourceStatusReason?: string;
  resourceType?: string;
  physicalResourceId?: string;
  arn?: string;
};

export type BackendMetadata = {
  name: string;
  lastUpdated: Date | undefined;
  deploymentType: DeploymentType;
  status: BackendDeploymentStatus;
  resources: DeployedBackendResource[];
  apiConfiguration?: {
    status: BackendDeploymentStatus;
    lastUpdated: Date | undefined;
    graphqlEndpoint: string;
    defaultAuthType: ApiAuthType;
    additionalAuthTypes: ApiAuthType[];
    conflictResolutionMode?: ConflictResolutionMode;
    apiId: string;
  };
  authConfiguration?: {
    status: BackendDeploymentStatus;
    lastUpdated: Date | undefined;
    userPoolId: string;
  };
  storageConfiguration?: {
    status: BackendDeploymentStatus;
    lastUpdated: Date | undefined;
    s3BucketName: string;
  };
};

export type ListSandboxesResponse = {
  sandboxes: SandboxMetadata[];
  nextToken: string | undefined;
};

export enum BackendDeploymentStatus {
  DEPLOYED = 'DEPLOYED',
  FAILED = 'FAILED',
  DEPLOYING = 'DEPLOYING',
  DELETING = 'DELETING',
  DELETED = 'DELETED',
  UNKNOWN = 'UNKNOWN',
}

export type DeployedBackendClient = {
  listSandboxes: (
    listSandboxesRequest?: ListSandboxesRequest
  ) => Promise<ListSandboxesResponse>;
  deleteSandbox: (
    sandboxBackendIdentifier: Omit<BackendIdentifier, 'type'>
  ) => Promise<void>;
  getBackendMetadata: (
    backendId: BackendIdentifier
  ) => Promise<BackendMetadata>;
};

export type DeployedBackendClientOptions = {
  s3Client: S3Client;
  cloudFormationClient: CloudFormationClient;
  backendOutputClient: BackendOutputClient;
};

export type DeployedBackendCredentialsOptions = {
  credentials: AwsCredentialIdentityProvider;
};

export type DeployedBackendClientFactoryOptions =
  | DeployedBackendCredentialsOptions
  | DeployedBackendClientOptions;

/**
 * Factory to create a DeploymentClient
 */
export class DeployedBackendClientFactory {
  /**
   * Returns a single instance of DeploymentClient
   */
  static getInstance(
    options: DeployedBackendClientFactoryOptions
  ): DeployedBackendClient {
    const stackStatusMapper = new StackStatusMapper();
    const arnGenerator = new ArnGenerator();
    const arnParser = new ArnParser();
    const deployedResourcesEnumerator = new DeployedResourcesEnumerator(
      stackStatusMapper,
      arnGenerator,
      arnParser
    );

    if (
      'backendOutputClient' in options &&
      'cloudFormationClient' in options &&
      's3Client' in options
    ) {
      return new DefaultDeployedBackendClient(
        options.cloudFormationClient,
        options.s3Client,
        options.backendOutputClient,
        deployedResourcesEnumerator,
        stackStatusMapper,
        arnParser
      );
    }
    return new DefaultDeployedBackendClient(
      new CloudFormationClient(options.credentials),
      new S3Client(options.credentials),
      BackendOutputClientFactory.getInstance({
        credentials: options.credentials,
      }),
      deployedResourcesEnumerator,
      stackStatusMapper,
      arnParser
    );
  }
}
