export interface ServiceStub {
  readonly name: string;
  readonly implemented: false;
}

export const createServiceStub = (name: string): ServiceStub => ({
  name,
  implemented: false
});
