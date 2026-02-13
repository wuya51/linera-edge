export const formatAddress = (address: string): string => {
  if (address.length <= 10) {
    return address;
  }
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
};

export const formatNumber = (num: any): string => {
  let number;
  if (typeof num === 'number') {
    number = num;
  } else if (typeof num === 'string') {
    number = Number(num);
  } else {
    number = Number(num);
  }
  
  if (isNaN(number)) {
    return '';
  }
  
  if (number === 0) {
    return '0';
  }
  
  const isAmountValue = number > 1e15;
  
  if (isAmountValue) {
    const tokens = number / 1e18;
    if (Math.abs(tokens - Math.round(tokens)) < 1e-9) {
      return Math.round(tokens).toString();
    } else {
      const fixed = tokens.toFixed(3);
      return fixed.replace(/\.?0+$/, '');
    }
  } else {
    if (Math.abs(number - Math.round(number)) < 1e-9) {
      return Math.round(number).toString();
    } else {
      const fixed = number.toFixed(3);
      return fixed.replace(/\.?0+$/, '');
    }
  }
};

export const formatTime = (timestamp: string): string => {
  const date = new Date(timestamp);
  return date.toLocaleString();
};
