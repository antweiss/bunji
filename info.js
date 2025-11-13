import si from "systeminformation";

export const getMem = () => {
  return si.mem()
}

export const getCPU = () => {
  return si.cpu()
}
