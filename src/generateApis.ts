import {
  getDefineParam,
  getJsdoc,
  getParamString,
  getSchemaName,
  getTsType,
  isAscending,
  isMatchWholeWord,
} from "./utils";
import { ApiAST, TypeAST } from "./types";
import {
  DEPRECATED_WARM_MESSAGE,
  SERVICE_BEGINNING,
  SERVICE_NEEDED_FUNCTIONS,
} from "./strings";

function getResponseType(type: string, types: TypeAST[]) {
  const typeAST = types.find((t) => t.name === type);
  if (typeAST && typeAST.schema && typeAST.schema.type === "object") {
    const { properties } = typeAST.schema;
    if (properties && properties.hasOwnProperty("data")) {
      const { data } = properties;
      return getTsType(data);
    }
  }
  return type;
}

function generateApis(apis: ApiAST[], types: TypeAST[]): string {
  let code = SERVICE_BEGINNING;
  try {
    const apisCode = apis
      .sort(({ endPoint }, { endPoint: _endPoint }) =>
        isAscending(endPoint, _endPoint),
      )
      .reduce(
        (
          prev,
          {
            contentType,
            summary,
            deprecated,
            serviceName,
            queryParamsTypeName,
            pathParams,
            requestBody,
            headerParams,
            isQueryParamsNullable,
            isHeaderParamsNullable,
            responses,
            method,
            endPoint,
            pathParamsRefString,
          },
        ) => {
          return (
            prev +
            `
${getJsdoc({
  description: summary,
  tags: {
    deprecated: {
      value: Boolean(deprecated),
      description: DEPRECATED_WARM_MESSAGE,
    },
  },
})}export const ${serviceName} = (
    ${
      /** Path parameters */
      pathParams
        .map(({ name, required, schema, description }) =>
          getDefineParam(name, required, schema, description),
        )
        .join(",")
    }${pathParams.length > 0 ? "," : ""}${
              /** Request Body */
              requestBody ? `${getDefineParam("body", true, requestBody)},` : ""
            }${
              /** Query parameters */
              queryParamsTypeName
                ? `${getParamString(
                    "params",
                    !isQueryParamsNullable,
                    queryParamsTypeName,
                  )},`
                : ""
            }${
              /** Header parameters */
              headerParams
                ? `${getParamString(
                    "headers",
                    !isHeaderParamsNullable,
                    headerParams,
                  )},`
                : ""
            }options?: RequestOptions
): Promise<${
              responses ? getResponseType(getTsType(responses), types) : "any"
            }> => {
  ${
    deprecated
      ? `
  if (__DEV__) {
    console.warn(
      "${serviceName}",
      "${DEPRECATED_WARM_MESSAGE}",
    );
  }`
      : ""
  }
  return defHttp.${method}(
  overrideConfigs(
  {
    url:
    ${
      pathParamsRefString
        ? `template(${serviceName}.key,${pathParamsRefString})`
        : `${serviceName}.key`
    },
    params:${queryParamsTypeName ? "params" : "undefined"},
    data:${
      requestBody
        ? contentType === "multipart/form-data" ||
          contentType === "application/x-www-form-urlencoded"
          ? "objToForm(body)"
          : "body"
        : "undefined"
    }
    }),overrideOptions(options)
  )
}

/** Key is end point string without base url */
${serviceName}.key = "${endPoint}";
`
          );
        },
        "",
      );

    code +=
      types.reduce((prev, { name: _name }) => {
        const name = getSchemaName(_name);

        if (!isMatchWholeWord(apisCode, name)) {
          return prev;
        }

        return prev + ` ${name},`;
      }, "import {") + '}  from "./types"\n';

    code += SERVICE_NEEDED_FUNCTIONS;
    code += apisCode;
    return code;
  } catch (error) {
    console.error(error);
    return "";
  }
}

export { generateApis };
