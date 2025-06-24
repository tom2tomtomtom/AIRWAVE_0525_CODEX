import { GetServerSideProps } from 'next';

export const getServerSideProps: GetServerSideProps = async () => {
  return {
    redirect: {},
      destination: '/assets',
      permanent: false }};
};

const ContentPage = (): JSX.Element | null => {
  return null;
};

export default ContentPage;
