import { User } from "../models/user.model.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import jwt from "jsonwebtoken";
const generateAccessAndRefreshTokens = async (userId) => {
  try {
    const user = await User.findById(userId);
    const accessToken = await user.generateAccessToken();
    const refreshToken = await user.generateRefreshToken();

    user.refreshToken = refreshToken;
    user.save({ validateBeforeSave: false });
    return { accessToken, refreshToken };
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Error In Generating Token",
    });
  }
};

const userRegister = async (req, res) => {
  try {
    const { username, email, password, fullName } = req.body;

    //checking all fields are filled or not
    if (
      [username, email, password, fullName].some(
        (val) => val?.trim() === "" || val === undefined
      )
    ) {
      return res.status(400).json({
        success: false,
        message: "All Fields Are Required",
      });
    }

    const userExist = await User.findOne({ $or: [{ username }, { email }] });
    if (userExist) {
      return res.status(409).json({
        success: false,
        message:
          userExist.email === email
            ? "Already Registered, Please Login"
            : "Username already taken",
      });
    }

    const emailRegex = /^([a-zA-Z0-9]{6,})@[a-zA-Z]{3,}\.[a-z]{2,10}$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        message: "Invalid Email Format",
      });
    }

    const avatarPath = req.files?.avatar && req.files?.avatar[0]?.path;
    const coverImagePath =
      req.files?.coverImage && req.files?.coverImage[0]?.path;
    if (!avatarPath) {
      return res.status(400).json({
        success: false,
        message: "Avatar is Required",
      });
    }

    const avatar = await uploadOnCloudinary(avatarPath);
    const coverImage = await uploadOnCloudinary(coverImagePath);

    if (!avatar) {
      return res.status(400).json({
        success: false,
        message: "Error while uploading avatar",
      });
    }

    const user = await User.create({
      fullName,
      email,
      password,
      username: username.toLowerCase(),
      avatar: avatar?.url,
      coverImage: coverImage?.url || "",
    });

    const createdUser = await User.findOne(
      { _id: user._id },
      { password: 0, refreshToken: 0 }
    );

    if (!createdUser) {
      return res
        .status(500)
        .json({ success: false, message: "User registration failed" });
    }

    return res.status(201).json({
      user: createdUser,
      success: true,
      message: "Registered Successfully",
    });
  } catch (error) {
    res.status((error.code < 500 && error.code) || 500).json({
      success: false,
      message: error.message || "Internal Server Error",
    });
  }
};

const userLogin = async (req, res) => {
  try {
    const { email, username, password } = req.body;
    if (!username && !email) {
      return res.status(400).json({
        success: false,
        message: "Email or Username is Required",
      });
    }

    if (password === "" || password === undefined) {
      return res.status(400).json({
        success: false,
        message: "Password is Required",
      });
    }

    const user = await User.findOne({ $or: [{ username }, { email }] });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "No Such User Found, Please Register",
      });
    }

    const isPasswordCorrect = await user.isPasswordCorrect(password);

    if (!isPasswordCorrect) {
      return res.status(401).json({
        success: false,
        message: "Invalid Credentials",
      });
    }

    const { accessToken, refreshToken } = await generateAccessAndRefreshTokens(
      user._id
    );

    const loggedInUser = await User.findById(user._id).select(
      "-password -refreshToken"
    );

    const options = {
      httpOnly: true,
      secure: true,
    };

    res
      .status(200)
      .cookie("accessToken", accessToken, options)
      .cookie("refreshToken", refreshToken, options)
      .json({
        user: loggedInUser,
        accessToken,
        refreshToken,
        success: true,
        message: "Login Successful",
      });
  } catch (error) {
    res.status((error.code < 500 && error.code) || 500).json({
      success: false,
      message: error.message || "Internal Server Error",
    });
  }
};

const userLogout = async (req, res) => {
  try {
    await User.findByIdAndUpdate(
      req.user._id,
      { $unset: { refreshToken: 1 } },
      { new: true }
    );

    const options = {
      httpOnly: true,
      secure: true,
    };

    res
      .status(200)
      .clearCookie("accessToken", options)
      .clearCookie("refreshToken", options)
      .json({
        success: true,
        message: "Logout Successful",
      });
  } catch (error) {
    res.status((error.code < 500 && error.code) || 500).json({
      success: false,
      message: error.message || "Internal Server Error",
    });
  }
};

const refreshAccessToken = async (req, res) => {
  const incomingRefreshToken =
    req.cookies.refreshToken || req.body.refreshToken;

  if (!incomingRefreshToken) {
    return res.status(401).json({
      success: false,
      message: "Unauthorized Request",
    });
  }

  try {
    const decodedToken = jwt.verify(
      incomingRefreshToken,
      process.env.REFRESH_TOKEN_SECRET
    );

    const user = await User.findById(decodedToken?._id);

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Invalid refresh token",
      });
    }

    if (incomingRefreshToken !== user?.refreshToken) {
      return res.status(401).json({
        success: false,
        message: "Refresh token is expired or used",
      });
    }

    const options = {
      httpOnly: true,
      secure: true,
    };

    const { accessToken, refreshToken } = await generateAccessAndRefreshTokens(
      user._id
    );

    return res
      .status(200)
      .cookie("accessToken", accessToken, options)
      .cookie("newRefreshToken", refreshToken, options)
      .json({
        accessToken,
        newRefreshToken: refreshToken,
        success: true,
        message: "Access token refreshed",
      });
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: error?.message || "Invalid refresh token",
    });
  }
};

const changeCurrentPassword = async (req, res) => {
  try {
    const { oldPassword, newPassword } = req.body;
    if (!oldPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: "All Fields Are Required",
      });
    }
    const user = await User.findById(req.user?._id);
    const isPasswordCorrect = await user.isPasswordCorrect(oldPassword);

    if (!isPasswordCorrect) {
      return res.status(401).json({
        success: false,
        message: "Invalid Old Password",
      });
    }

    user.password = newPassword;
    await user.save({ validateBeforeSave: false });

    return res.status(200).json({
      success: true,
      message: "Password Changed Successfully",
    });
  } catch (error) {
    res.status((error.code < 500 && error.code) || 500).json({
      success: false,
      message: error.message || "Internal Server Error",
    });
  }
};

const updateAccountDetails = async (req, res) => {
  try {
    const { fullName, email } = req.body;
    if (!fullName || !email) {
      return res.status(400).json({
        success: false,
        message: "All Fields Are Required",
      });
    }

    const existingEmail = await User.findOne({ email });

    if (existingEmail) {
      return res.status(409).json({
        success: false,
        message: "Email Already Taken",
      });
    }

    const emailRegex = /^([a-zA-Z0-9]{6,})@[a-zA-Z]{3,}\.[a-z]{2,10}$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        message: "Invalid Email Format",
      });
    }

    const user = await User.findByIdAndUpdate(
      req.user?._id,
      {
        $set: { fullName, email },
      },
      { new: true }
    ).select("-password -refreshToken");

    return res.status(200).json({
      success: true,
      user,
      message: "Accout Details Updated Successfully",
    });
  } catch (error) {
    res.status((error.code < 500 && error.code) || 500).json({
      success: false,
      message: error.message || "Internal Server Error",
    });
  }
};

const updateUserAvatar = async (req, res) => {
  try {
    const avatarLocalPath = req.file?.path;
    if (!avatarLocalPath) {
      return res.status(400).json({
        success: false,
        message: "Avatar file is missing",
      });
    }

    const avatar = await uploadOnCloudinary(avatarLocalPath);
    if (!avatar.url) {
      return res.status(400).json({
        success: false,
        message: "Error while uploading avatar",
      });
    }

    await User.findByIdAndUpdate(
      req.user?._id,
      { $set: { avatar: avatar?.url } },
      { new: true }
    ).select("-password -refreshToken");

    return res.status(200).json({
      success: true,
      message: "Avatar Updated Successfully",
    });
  } catch (error) {
    res.status((error.code < 500 && error.code) || 500).json({
      success: false,
      message: error.message || "Internal Server Error",
    });
  }
};
const updateUserCoverImage = async (req, res) => {
  try {
    const coverImageLocalPath = req.file?.path;
    if (!coverImageLocalPath) {
      return res.status(400).json({
        success: false,
        message: "Cover Image file is missing",
      });
    }

    const coverImage = await uploadOnCloudinary(coverImageLocalPath);
    if (!coverImage.url) {
      return res.status(400).json({
        success: false,
        message: "Error while uploading cover image",
      });
    }

    await User.findByIdAndUpdate(
      req.user?._id,
      { $set: { coverImage: coverImage?.url } },
      { new: true }
    ).select("-password -refreshToken");

    return res.status(200).json({
      success: true,
      message: "Cover Image Updated Successfully",
    });
  } catch (error) {
    res.status((error.code < 500 && error.code) || 500).json({
      success: false,
      message: error.message || "Internal Server Error",
    });
  }
};
// res.status((error.code < 500 && error.code) || 500).json({
//   success: false,
//   message: error.message || "Internal Server Error",
// });
export {
  userRegister,
  userLogin,
  userLogout,
  refreshAccessToken,
  changeCurrentPassword,
  updateAccountDetails,
  updateUserAvatar,
  updateUserCoverImage,
};
