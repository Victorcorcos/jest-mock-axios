// same structure as UppercaseProxy, just using a create() instance
import axios from "../lib/index";

export const instance = axios.create();

export const LowercaseProxy = (clientMessage) => {
    instance.interceptors.request.use((config) => config);
    instance.interceptors.response.use((config) => config);

    const CancelToken = axios.CancelToken;
    const source = CancelToken.source();

    // requesting data from server
    const axiosPromise = instance.post("/web-service-url/", { data: clientMessage, cancelToken: source.token });

    // converting server response to upper case
    const axiosPromiseConverted = axiosPromise.then((serverData) =>
        serverData.data.toLowerCase(),
    ).catch(() => {
        // tslint:disable-next-line: no-console
        console.log("catched!");
    });

    // returning promise so that client code can attach `then` and `catch` handler
    return axiosPromiseConverted;
};
