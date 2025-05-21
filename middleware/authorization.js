import jwt from 'jsonwebtoken';
import User from '../Models/UserModel';

const authMiddleware = async (req, res, next) => {
    const token = req.headers['authorization']?.split(' ')[1];
    if (!token) {
        return res.status(403).json({ message: 'A token is required for authentication' });
    }
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        console.log(decoded);
        
        const user = await User.findOne({email:decoded.email});
        if(!user){
            return res.status(404).json({ message: 'User not found' });
        }
        req.user = user;
        console.log(decoded.email);      
        next();
    } catch (error) {
        return res.status(401).json({ message: 'Token is invalid' });
    }
}
const authorizeRole = (role) =>{
    return (req,res,next)=>{
        if(req.user.role !== role){
            return res.status(403).json({message:'access denied...'});
        }
        next();
    }
}

export default {authMiddleware,authorizeRole};
