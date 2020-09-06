import MockAxios from "../lib";

describe("MockAxios.create", () => {
   describe("reset", () => {
       it("resets only own mocks", () => {
           const instanceA = MockAxios.create();
           const instanceB = MockAxios.create();

           instanceA.get("/test");
           instanceB.get("/test");

           instanceA.reset();

           expect(instanceA.get.mock.calls.length).toBe(0);
           expect(instanceB.get.mock.calls.length).toBe(1);
       });
   });
});
