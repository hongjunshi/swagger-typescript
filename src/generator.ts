import {
  generateServiceName,
  getHeaderParams,
  getParametersInfo,
  getPathParams,
  getRefName,
  toPascalCase,
} from "./utils";
import type {
  ApiAST,
  ConstantsAST,
  Method,
  Parameter,
  Schema,
  SwaggerConfig,
  SwaggerJson,
  SwaggerRequest,
  SwaggerResponse,
  TypeAST,
} from "./types";
import { generateApis } from "./generateApis";
import { generateTypes } from "./generateTypes";
import { generateHook } from "./generateHook";

function generator(
  input: SwaggerJson,
  config: SwaggerConfig,
): { code: string; hooks: string; type: string } {
  const apis: ApiAST[] = [];
  const types: TypeAST[] = [];
  let constantsCounter = 0;
  const constants: ConstantsAST[] = [];

  function getConstantName(value: string) {
    const constant = constants.find((_constant) => _constant.value === value);
    if (constant) {
      return constant.name;
    }

    const name = `_CONSTANT${constantsCounter++}`;

    constants.push({
      name,
      value,
    });

    return name;
  }

  try {
    Object.entries(input.paths).forEach(([endPoint, value]) => {
      Object.entries(value).forEach(
        ([method, options]: [string, SwaggerRequest]) => {
          const { operationId, security } = options;
          const parameters = options.parameters?.map<Parameter>((parameter) => {
            const { $ref } = parameter;
            if ($ref) {
              const name = $ref.replace("#/components/parameters/", "");
              return {
                ...input.components?.parameters?.[name]!,
                $ref,
                schema: { $ref } as Schema,
              };
            }
            return parameter;
          });

          const serviceName = generateServiceName(
            endPoint,
            method,
            operationId,
            config,
          );

          const pathParams = getPathParams(parameters);

          const {
            exist: queryParams,
            isNullable: isQueryParamsNullable,
            params: queryParameters,
          } = getParametersInfo(parameters, "query");
          let queryParamsTypeName: string | false = `${toPascalCase(
            serviceName,
          )}QueryParams`;

          queryParamsTypeName = queryParams && queryParamsTypeName;

          if (queryParamsTypeName) {
            types.push({
              name: queryParamsTypeName,
              schema: {
                type: "object",
                nullable: isQueryParamsNullable,
                properties: queryParameters?.reduce(
                  (prev, { name, schema, $ref, required, description }) => {
                    return {
                      ...prev,
                      [name]: {
                        ...($ref ? { $ref } : schema),
                        nullable: !required,
                        description,
                      } as Schema,
                    };
                  },
                  {},
                ),
              },
            });
          }

          const {
            params: headerParams,
            hasNullable: hasNullableHeaderParams,
          } = getHeaderParams(options.parameters, config);

          const requestBody = getBodyContent(options.requestBody);

          const contentType = Object.keys(
            options.requestBody?.content ||
              (options.requestBody?.$ref &&
                input.components?.requestBodies?.[
                  getRefName(options.requestBody.$ref as string)
                ]?.content) || {
                "application/json": null,
              },
          )[0] as ApiAST["contentType"];

          const accept = Object.keys(
            options.responses?.[200]?.content || {
              "application/json": null,
            },
          )[0];

          let responses = getBodyContent(options.responses?.[200]);
          if (!responses) {
            responses = getBodyContent(options.responses?.[201]);
          }
          let pathParamsRefString: string | undefined = pathParams.reduce(
            (prev, { name }) => `${prev}${name},`,
            "",
          );
          pathParamsRefString = pathParamsRefString
            ? `{${pathParamsRefString}}`
            : undefined;

          const additionalAxiosConfig = headerParams
            ? `{
              headers:{
                ...${getConstantName(`{
                  "Content-Type": "${contentType}",
                  Accept: "${accept}",

                }`)},
                ...headerParams,
              },
            }`
            : getConstantName(`{
              headers: {
                "Content-Type": "${contentType}",
                Accept: "${accept}",
              },
            }`);
          const { prefix } = config;
          apis.push({
            contentType,
            summary: options.summary,
            deprecated: options.deprecated,
            serviceName,
            queryParamsTypeName,
            pathParams,
            requestBody,
            headerParams,
            isQueryParamsNullable,
            isHeaderParamsNullable: hasNullableHeaderParams,
            responses,
            pathParamsRefString,
            endPoint: prefix
              ? endPoint.replace(new RegExp(`^${prefix}`, "i"), "")
              : endPoint,
            method: method as Method,
            security: security
              ? getConstantName(JSON.stringify(security))
              : "undefined",
            additionalAxiosConfig,
            queryParameters,
          });
        },
      );
    });

    if (input?.components?.schemas) {
      types.push(
        ...Object.entries(input.components.schemas).map(([name, schema]) => {
          return {
            name,
            schema,
          };
        }),
      );
    }

    if (input?.components?.parameters) {
      types.push(...Object.values(input.components.parameters));
    }
    if (input?.components?.requestBodies) {
      types.push(
        ...(Object.entries(input.components.requestBodies)
          .map(([name, _requestBody]) => {
            return {
              name: `RequestBody${name}`,
              schema: Object.values(_requestBody.content || {})[0]?.schema,
              description: _requestBody.description,
            };
          })
          .filter((v) => v.schema) as any),
      );
    }

    const code = generateApis(apis, types);
    // code += generateConstants(constants);
    const type = generateTypes(types);
    const hooks = config.reactHooks ? generateHook(apis, types, config) : "";

    return { code, hooks, type };
  } catch (error) {
    console.error({ error });
    return { code: "", hooks: "", type: "" };
  }
}

function getBodyContent(responses?: SwaggerResponse): Schema | undefined {
  if (!responses) {
    return responses;
  }

  return responses.content
    ? Object.values(responses.content)[0].schema
    : responses.$ref
    ? ({
        $ref: responses.$ref,
      } as Schema)
    : undefined;
}

export { generator };
