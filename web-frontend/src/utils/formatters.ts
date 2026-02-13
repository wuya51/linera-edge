// 格式化地址显示，只显示前6位和后4位
export const formatAddress = (address: string): string => {
  if (address.length <= 10) {
    return address;
  }
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
};

// 格式化数字显示
export const formatNumber = (num: number): string => {
  return num.toLocaleString();
};

// 格式化时间显示
export const formatTime = (timestamp: string): string => {
  const date = new Date(timestamp);
  return date.toLocaleString();
};
