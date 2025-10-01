const router=require('express').Router();
const { Category } = require('../../models');

router.get('/', async (_req,res,next)=>{
  try{
    const items = await Category.findAll({ order:[['sort_order','ASC'],['name','ASC']], attributes:['id','name','slug','icon','sort_order'] });
    res.json({ items });
  } catch(e){ next(e); }
});

module.exports=router;
