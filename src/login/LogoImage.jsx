import { useTheme, useMediaQuery } from '@mui/material';
import { useSelector } from 'react-redux';
import { makeStyles } from 'tss-react/mui';
import Logo from '../resources/images/logo-2.svg?react';
import LogoGif from '../resources/images/logo.gif';

const useStyles = makeStyles()((theme) => ({
  image: {
    alignSelf: 'center',
    maxWidth: '300px',
    maxHeight: '300px',
    width: '300px',
    height: '300px',
    margin: theme.spacing(2),
  },
}));

const LogoImage = ({ color }) => {
  const theme = useTheme();
  const { classes } = useStyles();

  const expanded = !useMediaQuery(theme.breakpoints.down('lg'));

  const logo = useSelector((state) => state.session.server.attributes?.logo);
  const logoInverted = useSelector((state) => state.session.server.attributes?.logoInverted);

  if (logo) {
    if (expanded && logoInverted) {
      return <img className={classes.image} src={logoInverted} alt="" />;
    }
    return <img className={classes.image} src={logo} alt="" />;
  }
  // Use GIF logo instead of SVG
  return <img className={classes.image} src={LogoGif} alt="" />;
};

export default LogoImage;
