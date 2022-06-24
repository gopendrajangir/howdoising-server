module.exports = (items) => {
  const data = items.map((item) => {
    item = item.toObject();
    item.id = item._id;
    return item;
  });
  return data;
};
