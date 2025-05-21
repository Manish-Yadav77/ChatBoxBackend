import jwt from 'jsonwebtoken';
// const User = require('../Models/User');
const AutheToken = (req,res,next)=>{
    const token = req.headers['authorization']?.split(' ')[1]; 
    if(!token){
        return res.status(403).json({message:'a token is required for authentication'})
    }
    try {
        const decode = jwt.verify(token,process.env.JWT_SECRET);
        // const user = User.findOne({email:decode.email});
        req.user = decode;
        // req.user = user;
        next();
        
    } catch (error) {
        return res.status(404).json({message:'token is invalid'})
    }
}

export default AutheToken;