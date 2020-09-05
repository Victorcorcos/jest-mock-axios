/**
 * TypeScript version of Axios mock for unit testing with [Jest](https://facebook.github.io/jest/).
 * This file is based on https://gist.github.com/tux4/36006a1859323f779ab0
 *
 * @author   knee-cola <nikola.derezic@gmail.com>
 * @license  @license MIT License, http://www.opensource.org/licenses/MIT
 */

import { SynchronousPromise, UnresolvedSynchronousPromise } from "synchronous-promise";
import Cancel from "./cancel/Cancel";
import CancelToken from "./cancel/CancelToken";
import {
    AxiosMockQueueItem,
    AxiosMockRequestCriteria,
    AxiosMockType,
    HttpResponse,
} from "./mock-axios-types";


const _checkCriteria = (item: AxiosMockQueueItem, criteria: AxiosMockRequestCriteria) => {
    if (criteria.method !== undefined && criteria.method.toLowerCase() !== item.method.toLowerCase()) {
        return false;
    }

    if (criteria.url !== undefined && criteria.url !== item.url) {
        return false;
    }

    return true;
};

export class MockAxiosInstance {

    /** a FIFO queue of pending request */
    private _pending_requests: AxiosMockQueueItem[] = [];

    private _newReq: (config?: any) => UnresolvedSynchronousPromise<any> = (config: any = {}, actualConfig: any = {}) => {
        if (typeof config === 'string') {
            // Allow for axios('example/url'[, config])
            actualConfig.url = config;
            config = actualConfig;
        }

        const method: string = config.method || "get";
        const url: string = config.url;
        const data: any = config.data;
        const promise: UnresolvedSynchronousPromise<any> = SynchronousPromise.unresolved();

        if (config.cancelToken) {
            config.cancelToken.promise.then((cancel: any) => {
                // check if promise is still waiting for an answer
                if (this._pending_requests.find(x => x.promise === promise)) {
                    this.mockError(cancel, promise)
                }
            })
        }

        this._pending_requests.push({
            config,
            data,
            method,
            promise,
            url
        });
        return promise;
    };

    private _helperReq = (method: string, url: string, data?: any, config?: any) => {
        const conf = data && config ? config : {};
        return this._newReq({
            ...conf,
            data,
            method,
            url,
        });
    };

    private _helperReqNoData = (method: string, url: string, config?: any) => {
        return this._helperReq(method, url, {}, config)
    }

    // mocking Axios methods
    get = jest.fn(this._helperReqNoData.bind(this, "get"));
    delete = jest.fn(this._helperReqNoData.bind(this, "delete"));
    head = jest.fn(this._helperReqNoData.bind(this, "head"));
    options = jest.fn(this._helperReqNoData.bind(this, "options"));

    post = jest.fn(this._helperReq.bind(this, "post"));
    put = jest.fn(this._helperReq.bind(this, "put"));
    patch = jest.fn(this._helperReq.bind(this, "patch"));

    request = jest.fn(this._newReq);

    interceptors = {
        request: {
            use: jest.fn(),
            eject: jest.fn(),
        },
        response: {
            use: jest.fn(),
            eject: jest.fn(),
        },
    };

    defaults = {
        headers: {
            common: [],
        },
    };

    popPromise = (promise?: SynchronousPromise<any>) => {
        if (promise) {
            // remove the promise from pending queue
            for (let ix = 0; ix < this._pending_requests.length; ix++) {
                const req: AxiosMockQueueItem = this._pending_requests[ix];

                if (req.promise === promise) {
                    this._pending_requests.splice(ix, 1);
                    return req.promise;
                }
            }
        } else {
            // take the oldest promise
            const req: AxiosMockQueueItem = this._pending_requests.shift();
            return req ? req.promise : void 0;
        }
    };

    popRequest = (request?: AxiosMockQueueItem) => {
        if (request) {
            const ix = this._pending_requests.indexOf(request);
            if (ix === -1) {
                return void 0;
            }

            this._pending_requests.splice(ix, 1);
            return request;
        } else {
            return this._pending_requests.shift();
        }
    };

    /**
     * Removes an item form the queue, based on it's type
     * @param queueItem
     */
    popQueueItem = (queueItem: SynchronousPromise<any> | AxiosMockQueueItem = null) => {
        // first let's pretend the param is a queue item
        const request: AxiosMockQueueItem = MockAxios.popRequest(
            queueItem as AxiosMockQueueItem,
        );

        if (request) {
            // IF the request was found
            // > set the promise
            return request.promise;
        } else {
            // ELSE maybe the `queueItem` is a promise (legacy mode)
            return this.popPromise(queueItem as UnresolvedSynchronousPromise<any>);
        }
    };

    mockResponse = (
        response?: HttpResponse,
        queueItem: SynchronousPromise<any> | AxiosMockQueueItem = null,
        silentMode: boolean = false,
    ): void => {
        // replacing missing data with default values
        response = Object.assign(
            {
                config: {},
                data: {},
                headers: {},
                status: 200,
                statusText: "OK",
            },
            response,
        );

        const promise = this.popQueueItem(queueItem);

        if (!promise && !silentMode) {
            throw new Error("No request to respond to!");
        } else if (!promise) {
            return;
        }

        // resolving the Promise with the given response data
        promise.resolve(response);
    };

    mockResponseFor = (
        criteria: string | AxiosMockRequestCriteria,
        response?: HttpResponse,
        silentMode: boolean = false,
    ): void => {
        if (typeof criteria === "string") {
            criteria = { url: criteria };
        }
        const queueItem = this.getReqMatching(criteria);

        if (!queueItem && !silentMode) {
            throw new Error("No request to respond to!");
        } else if (!queueItem) {
            return;
        }

        this.mockResponse(response, queueItem, silentMode);
    };

    mockError = (
        error: any = {},
        queueItem: SynchronousPromise<any> | AxiosMockQueueItem = null,
        silentMode: boolean = false,
    ) => {
        const promise = this.popQueueItem(queueItem);

        if (!promise && !silentMode) {
            throw new Error("No request to respond to!");
        } else if (!promise) {
            return;
        }

        // resolving the Promise with the given response data
        promise.reject(error);
    };

    lastReqGet = () => {
        return this._pending_requests[this._pending_requests.length - 1];
    };

    lastPromiseGet = () => {
        const req = this.lastReqGet();
        return req ? req.promise : void 0;
    };

    private _findReqByPredicate = (predicate: (item: AxiosMockQueueItem) => boolean) => {
        return this._pending_requests
            .slice()
            .reverse() // reverse cloned array to return most recent req
            .find(predicate);
    };

    getReqMatching = (criteria: AxiosMockRequestCriteria) => {
        return this._findReqByPredicate((x) => _checkCriteria(x, criteria));
    };

    getReqByUrl = (url: string) => {
        return this.getReqMatching({ url });
    };

    getReqByMatchUrl = (url: RegExp) => {
        return this._findReqByPredicate((x) => url.test(x.url));
    };

    queue = () => {
        return this._pending_requests;
    };

    reset = () => {
        // remove all the requests
        this._pending_requests.splice(0, this._pending_requests.length);

        // resets all information stored in the mockFn.mock.calls and mockFn.mock.instances arrays
        this.get.mockClear();
        this.post.mockClear();
        this.put.mockClear();
        this.patch.mockClear();
        this.delete.mockClear();
        this.head.mockClear();
        this.options.mockClear();
        this.request.mockClear();
        MockAxios.all.mockClear();
    };
}

// @ts-ignore
const MockAxios: AxiosMockType = new MockAxiosInstance();

MockAxios.all = jest.fn((values) => Promise.all(values));
// @ts-ignore
MockAxios.create = jest.fn(() => new MockAxiosInstance());


MockAxios.Cancel = Cancel;
MockAxios.CancelToken = CancelToken;
MockAxios.isCancel = (u): u is Cancel => {
    return !!(u && u.__CANCEL__);
};

// this is a singleton object
export default MockAxios;
