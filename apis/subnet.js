const ip_regex = /^((25[0-5]|(2[0-4]|1[0-9]|[1-9]|)[0-9])(\.(?!$)|$)){4}$/;
const ip_with_mask = /^(([0-9]|[1-9][0-9]|1[0-9]{2}|2[0-4][0-9]|25[0-5])\.){3}([0-9]|[1-9][0-9]|1[0-9]{2}|2[0-4][0-9]|25[0-5])(\/(3[0-2]|[1-2]?\d))?$/;

const ipv4_size = 32;
const byte_size = 8;
const ipv4_bytes = ipv4_size / byte_size;

function ip_to_num(str) {
  const nums = str.trim().split(".");
  const ip_num = (parseInt(nums[0]) << 3 * byte_size) | (parseInt(nums[1]) << 2 * byte_size) | (parseInt(nums[2]) << 1 * byte_size) | (parseInt(nums[3]) << 0 * byte_size);
  return ip_num;
  // let counter = nums.length;
  // const num = nums.reduce((accumulator, val) => {
  //   counter = Math.max(0, counter-1);
  //   return accumulator | (parseInt(val) << counter * byte_size);
  // }, 0);

  // return num;
}

function num_to_ip(num) {
  const num32_mask = 0xffffffff;
  const num8_mask = 0xff;
  const final_num = num & num32_mask;

  const block1 = (final_num >> ((ipv4_bytes-1)-0) * byte_size) & num8_mask;
  const block2 = (final_num >> ((ipv4_bytes-1)-1) * byte_size) & num8_mask;
  const block3 = (final_num >> ((ipv4_bytes-1)-2) * byte_size) & num8_mask;
  const block4 = (final_num >> ((ipv4_bytes-1)-3) * byte_size) & num8_mask;

  return `${block1}.${block2}.${block3}.${block4}`;

  // let str = "";
  // for (let i = 0; i < ipv4_bytes-1; ++i) {
  //   const block = (final_num >> ((ipv4_bytes-1)-i) * byte_size) & num8_mask;
  //   str += block+".";
  // }

  // const block = final_num & num8_mask;
  // str += ""+block;
  // return str;
}

function count_bits(num) {
  const mask = 0x1;
  let counter = 0;
  for (let i = 0; i < ipv4_size; ++i, counter += (num >> i) & mask) {}
  return counter;
}

function subnet_mask_to_num(str) {
  const ip_num = ip_to_num(str);
  return count_bits(ip_num);
}

function make_subnet_binary(num) {
  let mask_num = 0;
  for (let i = 0; i < num; ++i) {
    mask_num = mask_num | (1 << ((ipv4_size-1) - i));
  }
  return mask_num;
}

function num_to_subnet_mask(num) { return num_to_ip(make_subnet_binary(num)); }
function host_count_from_subnet(num) { return ~make_subnet_binary(num)+1; }
function make_network_address(mask, ip) { return ip & mask; }
function make_broadcast_address(mask, ip) { return ip | ~mask; }

let subnet = function(ip_str) {
  const final_ip_str = ip_str.trim();
  if (!ip_regex.test(final_ip_str) && !ip_with_mask.test(final_ip_str)) throw `Could not parse ip string '${final_ip_str}'`;

  const ip_parts = final_ip_str.split("/");
  this.ip = ip_parts[0];
  this.ip_num = ip_to_num(this.ip);
  this.subnet = ip_parts[1] ? parseInt(ip_parts[1]) : ipv4_size;
  this.mask_num = make_subnet_binary(this.subnet);
  this.mask = num_to_subnet_mask(this.subnet);
  this.network_num = make_network_address(this.mask_num, this.ip_num);
  this.network = num_to_ip(this.network_num);
  this.broadcast_num = make_broadcast_address(this.mask_num, this.ip_num);
  this.broadcast = num_to_ip(this.broadcast_num);
  this.total_host_count = host_count_from_subnet(this.subnet);
  this.usable_host_count = Math.max(0, this.total_host_count-2);
  this.host_min_num = this.network_num+1;
  this.host_max_num = this.broadcast_num-1;
  this.host_min = num_to_ip(this.host_min_num);
  this.host_max = num_to_ip(this.host_max_num);
  this.index = this.ip_num - this.host_min_num;
};

subnet.prototype.include = function(ip_address) {
  if (ip_regex.test(ip_address)) {
    const num = ip_to_num(ip_address);
    return num > this.network_num && num < this.broadcast_num;
  }

  if (ip_with_mask.test(ip_address)) {
    const input_subnet = new subnet(ip_address);
    return input_subnet.network_num >= this.network_num && input_subnet.broadcast_num <= this.broadcast_num;
  }  

  throw `IP address '${ip_address}' must be a valid ip address with or without subnet`;
};

subnet.prototype.overlap = function(ip_address) {
  if (ip_regex.test(ip_address)) {
    const num = ip_to_num(ip_address);
    return num > this.network_num && num < this.broadcast_num;
  }

  if (ip_with_mask.test(ip_address)) {
    const input_subnet = new subnet(ip_address);
    return this.include(input_subnet.network) || this.include(input_subnet.broadcast) ||
      input_subnet.include(this.network) || input_subnet.include(this.broadcast);
  } 

  throw `IP address '${ip_address}' must be a valid ip address with or without subnet`;
};

subnet.prototype.at = function(index) {
  if (index >= this.usable_host_count) return undefined;
  return num_to_ip(this.host_min_num + index);
};

subnet.prototype.range = function(start, end) {
  const max_num = Math.min(this.host_min_num + (end ? end : this.usable_host_count), this.broadcast_num);
  let ip_counter = Math.max(this.network_num + (start ? start : 0), this.network_num);
  return {
    [Symbol.iterator]: function() { return this; },
    next: function() {
      ip_counter += 1;
      if (ip_counter >= max_num) return { done: true };
      // может быть лучше возвращать сабнеты?
      return { done: false, value: num_to_ip(ip_counter) };
    }
  };
};

subnet.prototype.next_subnet = function() {
  const num32_mask = 0xffffffff;
  const broadcast_num = this.broadcast_num !== num32_mask ? this.broadcast_num+1 : 0;
  return new subnet(`${num_to_ip(broadcast_num+1)}/${this.subnet}`);
};

subnet.prototype.prev_subnet = function() {
  const num32_mask = 0xffffffff;
  const network_num = this.network_num !== 0 ? this.network_num-1 : num32_mask;
  return new subnet(`${num_to_ip(network_num-1)}/${this.subnet}`);
};

subnet.prototype.toString = function() {
  const subnet_num = this.subnet;
  if (subnet_num === ipv4_size) return this.network;
  return `${this.network}/${subnet_num}`;
};

subnet.prototype[Symbol.iterator] = function() {
  const max_num = this.broadcast_num;
  let ip_counter = this.network_num;
  return {
    next: function() {
      ip_counter += 1;
      if (ip_counter >= max_num) return { done: true };
      return { done: false, value: num_to_ip(ip_counter) };
    }
  };
};

subnet.is_ip_address = function(str) { return str && str !== "" && ip_regex.test(str); };
subnet.is_subnet_address = function(str) { return  str && str !== "" && ip_with_mask.test(str); };
subnet.num_to_ip = num_to_ip;
subnet.ip_to_num = ip_to_num;

//const subnet_test = new subnet("10.15.27.183/24");
//console.log(subnet_test);
// // console.log(subnet_test.at(3));
// for (const ip_address of subnet_test.range(2, 5)) {
//   console.log(ip_address);
// }

// //const iter = subnet_test.range(2);
// //console.log(iter.next());
// //console.log(iter.next());

// const test_ip = "10.0.29.123";
// const test_ip2 = "10.0.29.123/32";
// //console.log(test_ip.match(ip_regex));
// //console.log(test_ip2.match(ip_with_mask));

// const num = ip_to_num(test_ip);
// const new_ip = num_to_ip(num);
// //console.log(num);
// //console.log(new_ip);


// const subnet1 = "255.255.255.192";
// const subnet2_num = 16;
// const subnet1_num = subnet_mask_to_num(subnet1);
// const subnet2 = num_to_subnet_mask(subnet2_num);
// //console.log(subnet1,":",subnet1_num,":",num_to_subnet_mask(subnet1_num));
// //console.log(subnet2,":",subnet2_num,":",num_to_subnet_mask(subnet2_num));

// const test = new subnet("10.0.120.129/25");
// console.log(`Школа №19 адресация`);
// console.log(`Гейт: ${test.host_min}`);
// console.log(`Маска: ${test.mask}`);
// console.log(`Broadcast: ${test.broadcast}`);
// console.log(`Рег: ${num_to_ip(test.host_min_num+1)}`);
// console.log(`Кнопка: ${num_to_ip(test.host_min_num+3)}`);
// console.log(`Камеры: ${num_to_ip(test.host_min_num+10)} - ${num_to_ip(test.host_min_num+10+20)}`);

// const sub1 = new subnet("10.29.32.32/28");
// const sub2 = sub1.next_subnet();
// console.log(sub1);
// console.log(sub2);

module.exports = subnet;
