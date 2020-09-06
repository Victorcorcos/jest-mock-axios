import {LowercaseProxy, instance} from "./LowercaseProxy";
import CancelToken from "../lib/cancel/CancelToken";

afterEach(() => {
    // cleaning up the mess left behind the previous test
    instance.reset();
});

it("LowercaseProxy should get data from the server and convert it to lowercase", () => {
    const catchFn = jest.fn();
    const thenFn = jest.fn();

    // using the component, which should make a server response
    const clientMessage = "client is saying hello!";

    LowercaseProxy(clientMessage)
        .then(thenFn)
        .catch(catchFn);

    // since `post` method is a spy, we can check if the server request was correct
    // a) the correct method was used (post)
    // b) went to the correct web service URL ('/web-service-url/')
    // c) if the payload was correct ('client is saying hello!')
    expect(instance.post).toHaveBeenCalledWith("/web-service-url/", {
        data: clientMessage,
        cancelToken: expect.any(CancelToken)
    });

    // simulating a server response
    const responseObj = { data: "SERVER SAYS HELLO!" };
    instance.mockResponse(responseObj);

    // catch should not have been called
    expect(catchFn).not.toHaveBeenCalled();

    // checking the `then` spy has been called and if the
    // response from the server was converted to lower case
    expect(thenFn).toHaveBeenCalledWith("server says hello!");
});
