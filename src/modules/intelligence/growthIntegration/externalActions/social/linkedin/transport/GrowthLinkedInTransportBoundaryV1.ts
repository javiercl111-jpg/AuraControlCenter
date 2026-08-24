export interface GrowthLinkedInAccessTokenV1 {

  readonly accessToken:
    string;

  readonly tokenType:
    'Bearer';

  readonly expiresAt?:
    string;

}


export interface GrowthLinkedInTokenProviderV1 {

  getAccessToken():
    Promise<GrowthLinkedInAccessTokenV1>;

}


export interface GrowthLinkedInHttpRequestV1 {

  readonly method:
    'POST';

  readonly url:
    string;

  readonly headers:
    Readonly<Record<string, string>>;

  readonly body:
    unknown;

}


export interface GrowthLinkedInHttpResponseV1 {

  readonly status:
    number;

  readonly headers:
    Readonly<Record<string, string>>;

  readonly body:
    unknown;

}


export interface GrowthLinkedInHttpPortV1 {

  execute(
    request:
      GrowthLinkedInHttpRequestV1,
  ): Promise<GrowthLinkedInHttpResponseV1>;

}


export interface GrowthLinkedInTransportRequestV1 {

  readonly endpoint:
    string;

  readonly body:
    unknown;

  readonly idempotencyKey?:
    string;

}


export interface GrowthLinkedInTransportResultV1 {

  readonly status:
    number;

  readonly body:
    unknown;

}


export interface GrowthLinkedInTransportDependenciesV1 {

  readonly tokenProvider:
    GrowthLinkedInTokenProviderV1;

  readonly httpPort:
    GrowthLinkedInHttpPortV1;

}


export class GrowthLinkedInTransportBoundaryV1 {

  private readonly tokenProvider:
    GrowthLinkedInTokenProviderV1;

  private readonly httpPort:
    GrowthLinkedInHttpPortV1;


  constructor(
    dependencies:
      GrowthLinkedInTransportDependenciesV1,
  ) {

    this.tokenProvider =
      dependencies.tokenProvider;

    this.httpPort =
      dependencies.httpPort;

  }


  async execute(
    request:
      GrowthLinkedInTransportRequestV1,
  ): Promise<GrowthLinkedInTransportResultV1> {

    const token =
      await this.tokenProvider.getAccessToken();


    const headers:
      Record<string, string> = {

        Authorization:
          `${token.tokenType} ${token.accessToken}`,

        'Content-Type':
          'application/json',

      };


    if (request.idempotencyKey) {

      headers['Idempotency-Key'] =
        request.idempotencyKey;

    }


    const response =
      await this.httpPort.execute({

        method:
          'POST',

        url:
          request.endpoint,

        headers,

        body:
          request.body,

      });


    return {

      status:
        response.status,

      body:
        response.body,

    };

  }

}