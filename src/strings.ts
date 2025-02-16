import { readFileSync } from "fs";
import path from "path";
const HTTP_REQUEST = readFileSync(
  path.resolve(__dirname, "../files/httpRequest.tsf"),
).toString();

const CONFIG = readFileSync(
  path.resolve(__dirname, "../files/config.tsf"),
).toString();

const FILE_HOOKS_CONFIG = readFileSync(
  path.resolve(__dirname, "../files/hooksConfig.tsf"),
).toString();

const AUTOGENERATED_COMMENT = `
/**
* AUTO_GENERATED Do not change this file directly, use config.ts file instead
*
* @version 5
*/
`;

const SERVICE_BEGINNING = `${AUTOGENERATED_COMMENT}
import { defHttp } from '/@/utils/http/axios';
import { RequestOptions } from '/#/axios';
import { overrideConfigs, overrideOptions } from './config';
`;
const SERVICE_NEEDED_FUNCTIONS = `
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function template(path: string, obj: { [x: string]: any } = {}) {
    Object.keys(obj).forEach((key) => {
      const re = new RegExp(\`{\${key}}\`, "i");
      path = path.replace(re, obj[key]);
    });

    return path;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
`;

const HOOKS_BEGINNING = `${AUTOGENERATED_COMMENT}
import { useMemo } from "react";
import { AxiosRequestConfig } from "axios";
import {
  UseQueryOptions,
  useQuery,
  useMutation,
  UseMutationOptions,
  useInfiniteQuery,
  UseInfiniteQueryOptions,
  QueryClient,
} from "react-query";
import { RequestError, SwaggerResponse } from "./config";
import { paginationFlattenData, getPageSize, getTotal } from "./hooksConfig";

const useHasMore = (
  pages: Array<SwaggerResponse<any>> | undefined,
  list: any,
  queryParams: any,
) =>
  useMemo(() => {
    if (!pages || (pages && pages.length < 1)) {
      return false;
    }

    const total = getTotal(pages);

    if (total !== undefined) {
      if (list && list.length < total) {
        return true;
      }
      return false;
    }
    if (
      paginationFlattenData([pages[pages.length - 1]])?.length === getPageSize(queryParams as any)
    ) {
      return true;
    }

    return false;
  }, [pages, list, queryParams]);

`;

const DEPRECATED_WARM_MESSAGE =
  "This endpoint deprecated and will be remove. Please use an alternative";

export {
  AUTOGENERATED_COMMENT,
  SERVICE_NEEDED_FUNCTIONS,
  HTTP_REQUEST,
  SERVICE_BEGINNING,
  HOOKS_BEGINNING,
  CONFIG,
  DEPRECATED_WARM_MESSAGE,
  FILE_HOOKS_CONFIG,
};
