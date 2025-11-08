import { Eip1193Provider } from "ethers";

export interface EIP6963ProviderInfo {
  uuid: string;
  name: string;
  icon: string;
  rdns: string;
}

export interface Eip6963ProviderDetail {
  info: EIP6963ProviderInfo;
  provider: Eip1193Provider;
}

export type Eip6963AnnounceProviderEvent = {
  detail: Eip6963ProviderDetail;
};

